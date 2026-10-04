# Presentation Outline

## Slide Flow

1. **Title:** Nookly - Student housing discovery around OAU.
2. **Problem:** Students waste time asking around, comparing scattered hostel names, prices, distances and facilities.
3. **Users:** OAU students who need a faster way to compare on-campus and off-campus options.
4. **Data:** 48 verified hostel records, checked as of 03/10/2026 through personal enquiries and web research.
5. **Design:** Mobile-first views for Home, Map, Hostels, Filters and Planner.
6. **Map:** Leaflet/OpenStreetMap map with OSRM road routes to Library or Main Gate reference points.
7. **Tools:** Search, filters, comparison, saved hostels, budget calculator and report form.
8. **Engineering:** Static JSON data, escaped output, local storage, route caching, validation tests.
9. **Limitations and next steps:** No live traffic, no booking/payment, details can change, future admin dashboard.

## Live Demo Script

1. Start the static server and open Nookly.
2. Show the home page and the verified directory notice.
3. Open Hostels and search for a known hostel.
4. Apply a filter such as on-campus, off-campus, area or listing status.
5. Open a hostel card and point out rent period, room information and verified date.
6. Open the Map view, select a hostel and show the highlighted route.
7. Explain the two reference points: Library for on-campus, Main Gate for off-campus.
8. Compare two or three hostels in the Planner.
9. Send a correction report and show that it reaches Formspree.

## Likely Questions

- **Why not Google Maps API?** It adds billing/API-key complexity. The project uses Leaflet, OpenStreetMap and OSRM to stay free and easy to demo.
- **Are the distances exact?** No. They are planning estimates from stored coordinates and OSRM routes, without live traffic.
- **Does verified mean currently available?** No. It means the displayed details were checked as of 03/10/2026. Availability can change.
- **How do reports reach the team?** The report form sends to the connected Formspree endpoint.
- **What is the next improvement?** An admin page for reviewing reports and updating hostel records without editing JSON manually.
