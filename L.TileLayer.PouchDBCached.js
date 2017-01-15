L.TileLayer.PouchDB = L.TileLayer.extend({
options: {
	// ðŸ‚namespace TileLayer
	// ðŸ‚section PouchDB tile caching options
	// ðŸ‚option useCache: Boolean = false
	// Whether to use a PouchDB cache on this tile layer, or not
		useCache     : false,

	// ðŸ‚option saveToCache: Boolean = true
	// When caching is enabled, whether to save new tiles to the cache or not
		saveToCache  : true,

	// ðŸ‚option useOnlyCache: Boolean = false
	// When caching is enabled, whether to request new tiles from the network or not
		useOnlyCache : false,

	// ðŸ‚option useCache: String = 'image/png'
	// The image format to be used when saving the tile images in the cache
		cacheFormat : 'image/png',

	// ðŸ‚option cacheMaxAge: Number = 24*3600*1000
	// Maximum age of the cache, in seconds
		cacheMaxAge  : 96*3600*1000,

	// an array of tiles that were not correctly recieved from the server
		missedTiles : [],

	// Size limit for the DB in MB, (assuming a 12 Ko weight for a single tile)
		dbSizeLimit : 40    // in Mb
	},
	initialize: function (url, options) {
		this._url = url;
		options = L.setOptions(this, L.extend(this.options,options));
		this.addInitHook();
	},
	addInitHook: function () {
		// TODO: delete _seed_canvas if the tests with the original create tile method works fine
		if (!this.options.useCache) {
			this._db = null;
			this._canvas = null;
			return;
		}

		this._db = new PouchDB('offline-tiles');

		this._canvas = document.createElement('canvas');

		if (!(this._canvas.getContext && this._canvas.getContext('2d'))) {
			// HTML5 canvas is needed to pack the tiles as base64 data. If
			//   the browser doesn't support canvas, the code will forcefully
			//   skip caching the tiles.
			this._canvas = null;
		}

	}
});
L.TileLayer.PouchDB.include({
	// Overwrites L.TileLayer.prototype.createTile
	createTile: function(coords, done) {
		var tile = document.createElement('img');

		tile.onerror = L.bind(this._tileOnError, this, done, tile);

		if (this.options.crossOrigin) {
			tile.crossOrigin = '';
		}

		/*
		 Alt tag is *set to empty string to keep screen readers from reading URL and for compliance reasons
		 http://www.w3.org/TR/WCAG20-TECHS/H67
		 */
		tile.alt = '';

		var tileUrl = this.getTileUrl(coords);

		if (this.options.useCache && this._canvas) {
			this._db.get(tileUrl, {revs_info: true}, this._onCacheLookup(tile, tileUrl, done).bind(this));
		} else {
			// Fall back to standard behaviour
			tile.onload = L.bind(this._tileOnLoad, this, done, tile);
			//tile.onerror = L.bind(this._tileOnError, this, done, tile);
		}

		tile.src = tileUrl;
		return tile;
	},

	// Returns a callback (closure over tile/key/originalSrc) to be run when the DB
	//   backend is finished with a fetch operation.
	_onCacheLookup: function(tile, tileUrl, done) {
		return function(err, data) {
			if (data) {
				this.fire('tilecachehit', {
					tile: tile,
					url: tileUrl
				});
				if (Date.now() > data.timestamp + this.options.cacheMaxAge && !this.options.useOnlyCache) {
					// Tile is too old, try to refresh it
					//console.log('Tile is too old: ', tileUrl);

					if (this.options.saveToCache) {
						tile.onload = L.bind(this._saveTile, this, tile, tileUrl, data._revs_info[0].rev, done);
					}
					tile.crossOrigin = 'Anonymous';
					tile.src = tileUrl;
					tile.onerror = function(ev) {
						// If the tile is too old but couldn't be fetched from the network,
						//   serve the one still in cache.
						this.src = data.dataUrl;
					}
				} else {
					// Serve tile from cached data
					//console.log('Tile is cached: ', tileUrl);
					tile.onload = L.bind(this._tileOnLoad, this, done, tile);
					tile.src = data.dataUrl;    // data.dataUrl is already a base64-encoded PNG image.
				}
			} else {
				this.fire('tilecachemiss', {
					tile: tile,
					url: tileUrl
				});
				if (this.options.useOnlyCache) {
					// Offline, not cached
					//console.log('Tile not in cache', tileUrl);
					tile.onload = L.Util.falseFn;
					tile.src = L.Util.emptyImageUrl;
				} else {
					//Online, not cached, request the tile normally
// 					console.log('Requesting tile normally', tileUrl);
					if (this.options.saveToCache) {
						tile.onload = L.bind(this._saveTile, this, tile, tileUrl, null, done);
					} else {
						tile.onload = L.bind(this._tileOnLoad, this, done, tile);
					}
					tile.crossOrigin = 'Anonymous';
					tile.src = tileUrl;
				}
			}
		};
	},

	// Returns an event handler (closure over DB key), which runs
	//   when the tile (which is an <img>) is ready.
	// The handler will delete the document from pouchDB if an existing revision is passed.
	//   This will keep just the latest valid copy of the image in the cache.
	_saveTile: function(tile, tileUrl, existingRevision, done) {
		if (this._canvas === null) return;
		this._canvas.width  = tile.naturalWidth  || tile.width;
		this._canvas.height = tile.naturalHeight || tile.height;

		var context = this._canvas.getContext('2d');
		context.drawImage(tile, 0, 0);

		var dataUrl;
		try {
			dataUrl = this._canvas.toDataURL(this.options.cacheFormat);
		} catch(err) {
			this.fire('tilecacheerror', { tile: tile, error: err });
			return done();
		}
		if (existingRevision) {
			this._db.get(tileUrl, function(err, doc) {
				if (err) { return console.log(err); }
				this._db.remove(doc, function(err, response) {
					if (err) { return console.log(err); }
					// handle response
					// console.log(response);
				});
			}.bind(this));
		}
		// The doc id will be included in the doc obj to meet PouchDB 6.x compatibility
		var new_doc = {
			_id: tileUrl,
			dataUrl: dataUrl,
			timestamp: Date.now()
		};

		this._db.get(tileUrl, function(err, doc) {
			if (err) {
				// we assume that the error means no older version exists
				this._db.put(new_doc);
				return console.log(err);
			}
			// if an old version exist we update doc
			new_doc._rev = doc._rev; // we have to specify which revision we want to update
			this._db.put(new_doc, function(err, response) {
				if (err) { return console.log(err); }
				// handle response
				if (done) { 
					done();
					return;
				} // the seed next tile is binded here
			});
		}.bind(this));
		
		if(done) { done(); }
	},

	// ðŸ‚section PouchDB tile caching options
	// ðŸ‚method seed(bbox: LatLngBounds, minZoom: Number, maxZoom: Number): this
	// Starts seeding the cache given a bounding box and the minimum/maximum zoom levels
	// Use with care! This can spawn thousands of requests and flood tileservers!
	seed: function(bbox, minZoom, maxZoom) {
		if (!this.options.useCache) return;
		if (minZoom > maxZoom) return;
		if (!this._map) return;

		var queue = [];
		this.missedTiles = [];
		var Total_TilesNumber = 0 ;

		// FIXED: there was a wrong generation of y coordinates

		for (var z = maxZoom; z>=minZoom; z--) {  // we start from the maximum zoom so the maximum tiles number is calculated

			var nePoint = this._map.project(bbox.getNorthEast(),z),
			    swPoint = this._map.project(bbox.getSouthWest(),z),
			    tileBounds = this._pxBoundsToTileRange(L.bounds(nePoint,swPoint));


			// Calculate tile indexes as per L.TileLayer._update
				// we calculate the current global tile range for the given zoom level

			this._currentGlobalTileRange = this._pxBoundsToTileRange(this._map.getPixelWorldBounds(z));
		
			// TODO: estimate the time and size of the cache before seeding
			var delta_x = tileBounds.max.x - tileBounds.min.x,
				delta_y = tileBounds.max.y - tileBounds.min.y,
				nbr_Tiles = Math.abs(delta_x)*Math.abs(delta_y);

			Total_TilesNumber += Math.ceil(nbr_Tiles);
			if( Total_TilesNumber > this.dbSizeLimit*1024*12 ){
				alert('Number of tiles too high '+Total_TilesNumber+'!. please reduce zoom range or bounds.');
				return;
			}

			for (var j = tileBounds.min.y; j <= tileBounds.max.y; j++) {
				for (var i = tileBounds.min.x; i <= tileBounds.max.x; i++) {
					point = new L.Point(i, j);
					point.z = z;
					queue.push(this._getTileUrl(point,this._currentGlobalTileRange));
				}
			}

		}

		console.log(Total_TilesNumber +' tiles will be cached! ....');

		var seedData = {
			bbox: bbox,
			minZoom: minZoom,
			maxZoom: maxZoom,
			queueLength: queue.length
		};

		this.fire('seedstart', seedData);

		var tile = this._createTile();
		tile._layer = this;

		this._seedOneTile(tile, queue, seedData);

		return this;
	},

	_createTile: function () {
		var tile = document.createElement('img');

		if (this.options.crossOrigin) {
			tile.crossOrigin = 'Anonymous';
		}
		return tile;

	},

	// Modified L.TileLayer.PouchDB.getTileUrl, this will use the zoom given by the parameter coords
	//  instead of the maps current zoomlevel.
	_getTileUrl: function (coords,currentGlobalTileRange) {
		var zoom = coords.z;
		if (this.options.zoomReverse) {
			zoom = this.options.maxZoom - zoom;
		}
		zoom += this.options.zoomOffset;

		var data = {
			r: this.options.detectRetina && L.Browser.retina && this.options.maxZoom > 0 ? '@2x' : '',
			s: this._getSubdomain(coords),
			x: coords.x,
			y: coords.y,
			z: this.options.maxNativeZoom ? Math.min(zoom, this.options.maxNativeZoom) : zoom
		};
		if (this._map && !this._map.options.crs.infinite) {
			// from L.TileLayer tms = true but  _globalTileRange must correspond to the current zoom
			//var invertedY = this._globalTileRange.max.y - coords.y;
			var invertedY = currentGlobalTileRange.max.y - coords.y;
			if (this.options.tms) {
				data['y'] = invertedY;
			}
			data['-y'] = invertedY;  // either the user put tms = true or {-y} in the url
		}

		return L.Util.template(this._url, L.extend(data, this.options));
	},
	// Uses a defined tile to eat through one item in the queue and
	//   asynchronously recursively call itself when the tile has
	//   finished loading.     (that did not work properly especially on tiles error, the fix was to pass this as a call back for the save function)
	_seedOneTile: function(tile, remaining, seedData) {
		if (!remaining.length) {
			this.fire('seedend', seedData);
			return;
		}
		this.fire('seedprogress', {
			bbox:    seedData.bbox,
			minZoom: seedData.minZoom,
			maxZoom: seedData.maxZoom,
			queueLength: seedData.queueLength,
			remainingLength: remaining.length
		});

		var url = remaining.pop();

		this._db.get(url, function(err, data) {
			if (!data) {
				tile.onload = function(ev) {
					// Save tile to db and bind seedOnTile function as a callback
					this._saveTile(tile, url ,true, L.bind(this._seedOneTile, this, tile, remaining, seedData));

				}.bind(this);

				tile.onerror = function (ev) {
					// push the url into missed tiles for further operations
					
					this.missedTiles.push(url);
					
					// in case of a tile load error and we have pushed it once go to the next tile
					this._seedOneTile(tile, remaining, seedData);
				}.bind(this);

				tile.src = url; // get the image

			} else {
				
				this._seedOneTile(tile, remaining, seedData);
			}
		}.bind(this));

	}
});

L.tileLayer.pouchdb = function(url , options){
	return new L.TileLayer.PouchDB(url,options);
};
