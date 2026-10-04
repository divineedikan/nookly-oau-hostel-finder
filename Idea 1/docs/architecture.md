# Architecture and security notes

```mermaid
flowchart LR
  OSM[OpenStreetMap / Overpass] --> FETCH[scripts/fetch_osm.py]
  SURVEY[Student field survey CSV] --> CLEAN[scripts/clean_data.py]
  FETCH --> CLEAN
  CLEAN --> JSON[data/hostels.json]
  JSON --> BROWSER[Leaflet static web app]
  BROWSER --> TILES[OSM tile server]
  BROWSER --> ROUTES[OSRM route service]
  BROWSER --> REPORTS[Formspree report inbox]
```

The browser does not geocode and does not call Overpass at page load. Coordinates are persisted in `data/hostels.json`. Road routes are requested from OSRM and cached in browser storage for faster repeat visits. User correction reports are submitted through Formspree using the endpoint in `data/site_config.json`.

A future custom backend should use HTTPS, prepared statements, input validation, report rate limiting, moderation and hashed admin credentials.
