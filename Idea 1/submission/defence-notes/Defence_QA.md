# Defence Questions And Answers

## What problem does Nookly solve?

Nookly helps OAU students compare hostel options faster. It brings hostel names, rent context, room details, location, distance, map routes and report correction into one web-based system.

## What is the aim of the project?

The aim is to build a functional student housing discovery website for OAU students.

## Who are the target users?

The target users are OAU students, especially students trying to compare on-campus and off-campus accommodation.

## What technologies did you use?

The project uses HTML, CSS, JavaScript, JSON, Leaflet, OpenStreetMap, OSRM, Formspree, Python tests and Node.js tests.

## Why did you not use Google Maps API?

Google Maps API can require billing and key management. The project uses Leaflet, OpenStreetMap and OSRM because they are easier to host for a student project and do not require a paid map key.

## Is the project just static pages?

No. It loads structured data, filters hostels, sorts results, renders map markers, highlights routes, calculates budget totals, compares selected hostels and sends correction reports.

## Where is the database?

For this version, the data store is JSON. `data/hostels.json` acts as the structured data source. A future version can use MySQL/PHP or another backend for admin editing and report moderation.

## How do reports reach the project team?

The report form submits to the configured Formspree endpoint in `data/site_config.json`.

## What security measures are included?

The app escapes dynamic HTML, avoids exposing secret API keys, restricts external URLs to HTTPS and uses Formspree instead of an insecure custom backend.

## What tests were carried out?

The project uses JavaScript syntax checks, JavaScript behavior tests and Python tests. Browser testing was also done with responsive inspection and report submission.

## What are the limitations?

The project does not provide live traffic, booking, payment or guaranteed vacancy. Availability and rent can change after the verification date.

## What is the next improvement?

The next major improvement is an admin dashboard for reviewing submitted reports and updating hostel records without editing JSON directly.

