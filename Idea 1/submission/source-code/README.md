# Nookly: OAU Student Housing Finder

Nookly is a SWEP student housing web app for finding and comparing hostels around Obafemi Awolowo University, Ile-Ife. It combines verified on-campus hostel information, researched off-campus hostel leads, map-based routes, filters, comparison tools, budget planning and correction reports.

The current directory contains 48 hostel records. All published records display as verified, with the visible verification date shown as `03/10/2026`. On-campus hostel details are based on personal enquiries and official university context. Off-campus hostel details are based on web research, map leads and public listing/review information where available.

## Problems Solved

- Students can search named hostels instead of relying only on scattered word-of-mouth.
- On-campus and off-campus options are shown in one place.
- Rent period is clearer: on-campus rent is per session, off-campus rent is per year where supplied.
- Users can filter by area, room type, location type, listing status, water and distance.
- Users can compare up to three hostels.
- The map highlights the road route from a hostel to the right reference point: Hezekiah Oluwasanmi Library for on-campus hostels, and OAU Main Gate for off-campus hostels.
- Walking and driving estimates are displayed without claiming live Google Maps traffic.
- Users can send incorrect-detail reports through Formspree.
- Unknown rent or facility values are not invented for display.

## Main Features

- Mobile-first navigation with Home, Map, Hostels, Filters and Planner views.
- Verified hostel cards with price, room, availability and facility details where available.
- Leaflet map using OpenStreetMap tiles.
- OSRM/OpenStreetMap road routing with cached route results.
- Separate on-campus and off-campus reference points.
- Budget calculator for rent, additional fees and transport.
- Saved hostel and comparison tools stored locally in the browser.
- Report form connected to Formspree through `data/site_config.json`.

## Run The App

Double-clicking `index.html` may show the page, but some browsers block local JSON loading. Use a local static server from this folder for the complete app:

```powershell
cd "C:\Users\HP\Documents\workspace\SWEP PROJECT\Idea 1"
python -m http.server 8000
```

Open:

```text
http://localhost:8000/
```

## Report Delivery

Reports are sent to Formspree using the endpoint in `data/site_config.json`:

```json
"report_endpoint": "https://formspree.io/f/xrpbnnvd"
```

The user only sees one action: `Send report`. The app also keeps a local browser backup of submitted report data.

## Data And Routing Notes

The app does not use the paid Google Maps API. It uses Leaflet, OpenStreetMap tiles and OSRM routing. Some hostel coordinates were researched from online map leads, but road routes are generated through OSRM/OpenStreetMap.

Driving estimates exclude live traffic. Walking estimates use available road distance when a route is loaded, otherwise they use the stored reference distance with a route allowance. These are planning estimates, not a guarantee of exact travel time.

## Data Rules

- Do not invent hostel names, prices, contacts, coordinates, ratings or safety claims.
- Keep unknown details hidden or marked as unavailable instead of guessing.
- Keep school hostel prices separate from off-campus yearly rent.
- Publish contacts only when there is consent or a public business contact.
- Preserve OpenStreetMap attribution when using map tiles.

## Tests

Run these checks before submission:

```powershell
node --check app.js
node tests/test_app.cjs
python -m pytest tests -q -p no:cacheprovider
```

## Demo Flow

1. Open the app and show the verified directory notice.
2. Go to Hostels and search for a known hostel such as Angola, Moremi or Makarios.
3. Use filters for area, location type or listing status.
4. Open the Map view and select a hostel to show the highlighted road route.
5. Compare two or three hostels in the Planner.
6. Send a test correction report and confirm it arrives in Formspree.

## Limitations

- Rent, room details and availability can change after the verification date.
- The map does not include live traffic.
- OSRM routing depends on available OpenStreetMap road data.
- A verified listing does not mean guaranteed safety or guaranteed vacancy.
- The project is a student housing discovery tool, not a booking or payment platform.
