



L.TileLayer.PouchDBCached = L.TileLayer.extend({

    options: {
        requestTiles: true, // If false, will only use tiles already existing on the cache
        cacheTiles: true    // If false, will not cache new tiles.
    },

    initialize: function(url, options){
        this.db = new PouchDB('offline-tiles');
        this.canvas = document.createElement('canvas');

        if (!(this.canvas.getContext && this.canvas.getContext('2d'))) {
            // HTML5 canvas is needed to pack the tiles as base64 data. If
            //   the browser doesn't support canvas, the code will forcefully
            //   skip caching the tiles.
            this.canvas = null;
        }

        L.TileLayer.prototype.initialize.call(this,url,options);
    },

    // Overwrites L.TileLayer.prototype_loadTile
    _loadTile: function(tile, tilePoint) {
        tile._layer  = this;
        tile.onerror = this._tileOnError;

        this._adjustTilePoint(tilePoint);

        var originalSrc = this.getTileUrl(tilePoint);
        this.fire('tileloadstart', {
            tile: tile,
            url: originalSrc
        });

        var key = this._url + '-' + tilePoint.z + ',' + tilePoint.y + ',' + tilePoint.x;

        this.db.get(key, this._onCacheLookup(tile,key,originalSrc));
    },

    // Returns a callback (closure over tile/key/originalSrc) to be run when the DB
    //   backend is finished with a fetch operation.
    _onCacheLookup: function(tile,key,originalSrc) {
        return function(err,data) {
            if (data) {
                tile.onload  = this._tileOnLoad;
                tile.src = data.dataUrl;    // data.dataUrl is already a base64-encoded PNG image.
            } else {
                if (!this.options.requestTiles) {
                    tile.onload  = this._tileOnLoad;
                    tile.src = L.Util.emptyImageUrl;
                } else {
                    if (this.options.cacheTiles) {
                        tile.onload = this._saveTile(key);
                    }
                    tile.crossOrigin = 'Anonymous';
                    tile.src = originalSrc;
                }
            }
        }.bind(this);
    },

    // Returns an event handler (closure over DB key), which runs
    //   when the tile (which is an <img>) is ready.
    _saveTile: function(key) {
        return function(ev) {
            if (this.canvas === null) return;
            var img = ev.target;
            L.TileLayer.prototype._tileOnLoad.call(img,ev);
            this.canvas.width  = img.naturalWidth  || img.width;
            this.canvas.height = img.naturalHeight || img.height;

            var context = this.canvas.getContext('2d');
            context.drawImage(img, 0, 0);

            var dataUrl = this.canvas.toDataURL('image/png');
            var doc = {dataUrl: dataUrl};
            this.db.put(doc, key);
        }.bind(this);
    }
});




L.tileLayer.pouchDBCached = function (url, options) {
    return new L.TileLayer.PouchDB(url, options);
};

