
A Leaflet tile layer that caches tiles into a PouchDB database in a transparent fashion.

Heavily based on https://github.com/tbicr/OfflineMap

Works with Leaflet 0.7.3 and PouchDB 3.3.1.

To use, simply replace `L.tileLayer(url,opts)` with `L.tileLayer.pouchDBCached(url,opts)`. Also available for WMS layers: simply replace `L.tileLayer.wms(url,opts)` with `L.tileLayer.wms.pouchDBCached(url,opts)`.

Under MIT license.

