# SWEP lecture mapping

| Topic | Project evidence |
|---|---|
| Web Technology | `index.html`, `styles.css`, `app.js`: semantic HTML, responsive CSS, JavaScript filters and Leaflet UI. |
| Database Design with MySQL/PHP | Planned stretch schema and PDO API are deferred until the static MVP and data consent process are tested. |
| Backend Development with Python | `scripts/fetch_osm.py` uses requests; `scripts/clean_data.py` uses pandas for survey merging. |
| Product Design and Management | MVP scope, personas/user stories in this document and report outline; timeline below. |
| Data Analysis and Data Science | `clean_data.py` calculates Haversine distance. Price summary, histogram and scatter plot are not claimed until the real sample exists. |
| Cyber Security | Escaped DOM values, provenance validation, no secrets, privacy note, prepared-statement requirement for any future API, and report abuse boundary. |
| Networking | Browser requests static JSON and OSM tiles; scripts call Overpass over HTTP; static server avoids file-fetch restrictions. |
| Hybrid mobile | PWA is a later stretch goal; not included in the MVP. |
| Machine Learning in production | Not justified: the initial dataset is too small and sparse for a useful model. |

## MVP backlog

1. Fetch and clean attributable OSM/survey data.
2. Map and list with empty state.
3. Filter by price, area, room type, water and distance.
4. Show source, verification and last-verified date.
5. Test with students and document limits.

Later: moderated backend reports, PWA caching, analytics, and only then a justified API.

## Timeline to 23 October 2026

| Period | Work |
|---|---|
| 3-4 Oct | Pipeline, schema contract, research notes, initial tests |
| 5-9 Oct | OSM candidates and field-survey pilot; consent review |
| 10-14 Oct | Clean real data, UI integration, accessibility checks |
| 15-18 Oct | Student user tests, charts if sample is adequate, report writing |
| 19-23 Oct | Week 6 demonstration, findings and backlog revision |
