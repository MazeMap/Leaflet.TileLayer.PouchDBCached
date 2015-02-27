
A Leaflet tile layer that caches tiles into a PouchDB database in a transparent fashion.

Heavily based on https://github.com/tbicr/OfflineMap

Works with Leaflet 0.7.3 and PouchDB 3.3.1.

To use, simply replace `L.tileLayer(url,opts)` with `L.tileLayer.pouchDBCached(url,opts)`. Also available for WMS layers: simply replace `L.tileLayer.wms(url,opts)` with `L.tileLayer.wms.pouchDBCached(url,opts)`.

PouchDBCached layers accept a `maxAge` option: the time (in MILLIseconds) that has to pass in order to consider a cached tile 'dirty' so it will be requested again. By default, the maximum tile age is 24 hours.

It is possible to seed a layer cache. See `test.html` for a easy to understand working example. The seeding algorithm is a bit naïve and uses only one concurrent download thread.

Under MIT license.

