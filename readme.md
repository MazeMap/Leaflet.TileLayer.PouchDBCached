

Allows all Leaflet TileLayers to cache into PouchDB for offline use, in a transparent fashion.

There is a [demo](http://mazemap.github.io/Leaflet.TileLayer.PouchDBCached/demo.html) available, which shows cache hits/misses/seeds in the browser's developer console.

# Dependencies

Works with Leaflet 1.0.0 and PouchDB 5.2.0 (or greater).

You probably want to load Leaflet, PouchDB and Leaflet.TileLayer.PouchDB like so:

```html
	<script src="https://unpkg.com/leaflet@^1.0.0/dist/leaflet-src.js"></script>
	<script src="https://unpkg.com/pouchdb@^5.2.0/dist/pouchdb.js"></script>
	<script src="https://unpkg.com/leaflet.tilelayer.pouchdbcached@latest/L.TileLayer.PouchDBCached.js"></script>
```

If you are still using Leaflet 0.7.x, the latest compatible release is [v0.1.0](https://github.com/MazeMap/Leaflet.TileLayer.PouchDBCached/releases/tag/v0.1.0).


# Usage

The plugin modifies the core `L.TileLayer` class, so it should be possible to cache any tile layer.

To use, add the option `useCache` with a value of `true` when instantiating your layer. You probably want to use Leaflet's `crossOrigin` option, like so:

```
var layer = L.tileLayer('https://whatever/{z}/{x}/{y}.png', {
	maxZoom: 18,

	useCache: true,
	crossOrigin: true
});
```

Options available are as follows:

* `useCache`: set to true in order to enable the cache. This option must be set at initialization time.
* `saveToCache`: Whether to save new tiles to the cache or not. Defaults to true.
* `useOnlyCache`: Whether to fetch tiles from the network or not. Defaults to false.
* `cacheMaxAge`: Time, in milliseconds, for any given tile to be considered 'fresh'. Tiles older than this value will be re-requested from the network. Defaults to 24 hours.

New functions available are as follows:
* `seed`: Starts seeding the cache for a given bounding box (a `L.LatLngBounds`), and between the two given zoom levels.

New events available are as follows:

* `tilecachehit`: Fired when a tile has been found in the tile cache. The event includes data as per http://leafletjs.com/reference.html#tile-event
* `tilecachemiss`: Like `tilecachehit`, but is fired when the tile has *not* been found in the cache.
* `tilecacheerror`: Fired when there was an error trying to save a tile in the cache. The event data includes:
 * `tile`: A reference to the failed tile
 * `error`: The error message, probably related to CORS.
* `seedstart`: Fired when a layer cache has started seeding. The event data includes:
 * `bbox`: bounding box for the seed operation, as per the `L.TileLayer.seed()` function call.
 * `minZoom` and `maxZoom`: zoom levels the seed operation, as per the `L.TileLayer.seed()` function call.
 * `queueLength`: (integer) Total number of tiles to be loaded during the seed operation.
* `seedend`: Fired when a layer cache has finished seeding.
* `seedprogress`: Fired every time a tile is cached during a seed operation
 * `remainingLength`: (integer) How many tiles are left in the seed queue. Starts with a value of `queueLength` and drops down to zero.


# Cross-Origin Resource Sharing

Due to the tile images being parsed and stored by the browser (technically, extracting data from a canvas in which a external image has been loaded into), the tiles must come from a tile server which allows CORS (Cross-Origin Resource Sharing) on the tiles. So tiles must have a CORS header allowing them to be loaded in the document where you're using this caching layer.

In other words: if chrome shows a grey map, and displays CORS-related messages in the console, make sure that your tileserver adds this header to all tiles:

`Access-Control-Allow-Origin: *`


# Underlying cache structure

This plugin uses an instance of PouchDB, named `offline-tiles`. PouchDB is a key-value store, so the key is the URL of a tile, and the value is a plain object containing a timestamp and the base64-encoded image.


# License and stuff

Under MIT license.

Heavily inspired by https://github.com/tbicr/OfflineMap

