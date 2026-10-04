const FALLBACK_HOSTELS = [];
const state = { hostels: [], markers: new Map(), gate: null, campusReference: null, connection: null, selectedHostelId: null, reportEndpoint: "" };
const $ = (id) => document.getElementById(id);
// Ile-Ife / OAU bounds include every listing with room to explore nearby streets.
const IFE_BOUNDS = [[7.44, 4.45], [7.58, 4.62]];
const map = window.L ? L.map("map", {
  scrollWheelZoom: false,
  minZoom: 13,
  maxZoom: 19,
  maxBounds: IFE_BOUNDS,
  maxBoundsViscosity: 1
}).setView([7.505, 4.527], 14) : null;
if (map && L.control?.scale) L.control.scale({imperial:false, position:"bottomleft", maxWidth:100}).addTo(map);
if (!map) $("map").textContent = "Map unavailable. You can still browse hostel listings.";
const baseTiles = map ? L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  minZoom: 13,
  bounds: IFE_BOUNDS,
  noWrap: true,
  updateWhenIdle: true,
  updateWhenZooming: false,
  keepBuffer: 1,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
}).addTo(map) : null;

let tileFailures = 0;
let alternateTiles = false;
function retryMapTiles() {
  tileFailures = 0;
  $('tile-status').hidden = true;
  if (baseTiles && baseTiles.redraw) baseTiles.redraw();
  if (map) map.invalidateSize();
}
if (baseTiles && baseTiles.on) {
  baseTiles.on('tileerror', () => {
    tileFailures++;
    if (tileFailures < 4) return;
    if (!alternateTiles) {
      alternateTiles = true;
      tileFailures = 0;
      baseTiles.setUrl('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png');
    } else $('tile-status').hidden = false;
  });
  baseTiles.on('tileload', () => { tileFailures = 0; $('tile-status').hidden = true; });
}
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
}
function formatDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "Date not recorded";
}
function display(value, fallback = "Unverified") { return value === null || value === undefined || value === "" ? fallback : escapeHtml(value); }
function hasWater(hostel) { return hostel.water === true || ["yes", "Yes", "true", "True"].includes(hostel.water); }
function hasCoordinates(item) {
  return item != null && Number.isFinite(item.latitude) && Number.isFinite(item.longitude)
    && Math.abs(item.latitude) <= 90 && Math.abs(item.longitude) <= 180;
}
function verifiedLabel(hostel) { return hostel.verification_display_status || "Verified"; }
function listingLabel(status) { return status === "available_on_ballot" ? "Available on ballot" : status === "available" ? "Available" : status === "unavailable" ? "Unavailable" : status === "lead" ? "Availability not stated" : "Status unverified"; }
function campusLabel(status) { return status === "on_campus" ? "On campus" : ["off_campus", "likely_off_campus"].includes(status) ? "Off campus" : ""; }
function safeExternalUrl(value) { return /^https:\/\//i.test(String(value || "")) ? String(value) : ""; }
function refreshIcons() { if (window.lucide) window.lucide.createIcons(); }
function listValues(values) { return Array.isArray(values) ? values.filter(Boolean).map(escapeHtml).join(", ") : ""; }
function money(value) { return Number.isFinite(Number(value)) ? `NGN ${Number(value).toLocaleString()}` : null; }
function pricingOptions(hostel) {
  return Array.isArray(hostel.pricing_options)
    ? hostel.pricing_options
      .filter((option) => option && option.label && Number.isFinite(Number(option.total_ngn)))
      .map((option) => `${escapeHtml(option.label)}: ${money(option.total_ngn)} total`)
      .join(" - ")
    : "";
}
function locationText(hostel) {
  const area = String(hostel.area || "").trim();
  const address = String(hostel.address_description || "").trim();
  const campus = campusLabel(hostel.campus_status);
  const place = address || area;
  const parts = campus && place && !place.toLowerCase().startsWith(campus.toLowerCase())
    ? [campus, place]
    : [place || campus];
  return parts.filter(Boolean).map(escapeHtml).join(" - ") || "Location unverified";
}
function hasValue(value) { return value !== null && value !== undefined && value !== "" && !(Array.isArray(value) && value.length === 0); }
function prettyKey(key) { return key.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function facilities(hostel) { return Object.entries(hostel.facilities || {}).filter(([, value]) => hasValue(value)).map(([key, value]) => `${escapeHtml(prettyKey(key))}: ${value === false ? "No" : value === true ? "Yes" : escapeHtml(value)}`).join(" - "); }
function detailChips(hostel) {
  const details = [
    ["Gender", hostel.gender_policy],
    ["Rent", hostel.price_display_note],
    ["Water", hostel.water],
    ["Power", hostel.power_hours_estimate],
    ["Rooms available", hostel.rooms_available],
    ["Caution fee", hostel.caution_fee_ngn == null ? null : `NGN ${Number(hostel.caution_fee_ngn).toLocaleString()}`],
    ["Agent fee", hostel.agent_fee_ngn == null ? null : `NGN ${Number(hostel.agent_fee_ngn).toLocaleString()}`],
    ["Facilities", facilities(hostel)],
    ["Rate options", pricingOptions(hostel)]
  ];
  return details.filter(([, value]) => hasValue(value)).map(([label, value]) => `<span class="detail-chip"><strong>${escapeHtml(label)}:</strong> ${["Facilities", "Rate options"].includes(label) ? value : escapeHtml(value)}</span>`).join("");
}
function priceText(hostel) {
  const period = hostel.rent_period || (hostel.campus_status === "on_campus" ? "session" : ["off_campus", "likely_off_campus"].includes(hostel.campus_status) ? "year" : null);
  const suffix = period ? ` / ${period}` : "";
  if (hostel.price_min_ngn != null || hostel.price_max_ngn != null) {
    const minimum = hostel.price_min_ngn == null ? "" : `NGN ${Number(hostel.price_min_ngn).toLocaleString()}`;
    const maximum = hostel.price_max_ngn == null ? "" : `NGN ${Number(hostel.price_max_ngn).toLocaleString()}`;
    if (minimum && maximum && minimum === maximum) return `${minimum}${suffix}`;
    return minimum && maximum ? `${minimum}-${maximum}${suffix}` : `${minimum || maximum}${suffix}`;
  }
  return hostel.price_per_year_ngn == null ? "Price on enquiry" : `NGN ${Number(hostel.price_per_year_ngn).toLocaleString()}${suffix}`;
}
function referencePoint(hostel) { return hostel.campus_status === 'on_campus' ? state.campusReference : state.gate; }
function referenceName(hostel) { return hostel.campus_status === 'on_campus' ? 'Hezekiah Oluwasanmi Library' : 'OAU Main Gate'; }
function referenceDistance(hostel) { return hostel.distance_to_reference_km ?? (hostel.campus_status === 'on_campus' ? null : hostel.distance_to_gate_km); }
function walkEstimate(hostel) {
  const route = roadRoutes.get(hostel.id);
  const km = route ? route.distance / 1000 : referenceDistance(hostel);
  if (!Number.isFinite(km) || km < 0) return "Walk estimate unavailable";
  const minutes = Math.ceil(km * (route ? 1 : 1.3) / 4 * 60);
  const basis = route ? "road distance; not a pedestrian route" : "approximate distance with a 30% route allowance";
  return `<span title="Assumes 4 km/h using ${basis}. Actual paths and pace may differ.">${minutes} min walk estimate</span>`;
}
function roadEstimate(hostel) {
  const route = roadRoutes.get(hostel.id);
  return route ? `${Math.ceil(route.duration / 60)} min drive (no traffic)` : "Driving time pending route";
}
function routeDistance(hostel) {
  const route = roadRoutes.get(hostel.id);
  return route ? `${(route.distance / 1000).toFixed(1)} km by road to ${escapeHtml(referenceName(hostel))}` : "Road distance pending route";
}
function routeDisplayGeometry(hostel, route) {
  const destination = referencePoint(hostel);
  const coordinates = route?.geometry?.coordinates;
  if (!Array.isArray(coordinates) || !coordinates.length || !hasCoordinates(destination)) return route?.geometry;
  const last = coordinates[coordinates.length - 1];
  const target = [destination.longitude, destination.latitude];
  const sameTarget = Array.isArray(last) && Math.abs(last[0] - target[0]) < 0.00001 && Math.abs(last[1] - target[1]) < 0.00001;
  return sameTarget ? route.geometry : {...route.geometry, coordinates: [...coordinates, target]};
}
function refreshTravelDetails(hostel) {
  document.querySelectorAll('[data-walk-time]').forEach(node => { if (node.dataset.walkTime === hostel.id) node.innerHTML = walkEstimate(hostel); });
  document.querySelectorAll('[data-road-time]').forEach(node => { if (node.dataset.roadTime === hostel.id) node.textContent = roadEstimate(hostel); });
  document.querySelectorAll('[data-road-distance]').forEach(node => { if (node.dataset.roadDistance === hostel.id) node.textContent = routeDistance(hostel); });
  const marker = state.markers.get(hostel.id);
  if (marker && marker.setPopupContent) marker.setPopupContent(popup(hostel));
}
function hasPublishableName(hostel) { return hostel != null && typeof hostel.name === "string" && hostel.name.trim().length > 0; }
function visibleHostels() { return state.hostels.filter((hostel) => hasPublishableName(hostel) && hostel.visible_on_site !== false); }

function matchesFilters(hostel) {
  const term = $("search").value.trim().toLowerCase();
  const min = Number($("min-price").value) || 0;
  const max = $("max-price").value === "" ? Infinity : Number($("max-price").value);
  const priceLow = hostel.price_min_ngn ?? hostel.price_per_year_ngn ?? hostel.price_max_ngn;
  const priceHigh = hostel.price_max_ngn ?? hostel.price_per_year_ngn ?? hostel.price_min_ngn;
  // Search inclusion only: these bounds are not a quoted rent and never enter listing data.
  const includeUnpricedOffCampus = priceLow == null
    && ["off_campus", "likely_off_campus"].includes(hostel.campus_status)
    && max >= 150000 && min <= 800000;
  const distance = Number($("max-distance").value);
  return (!$("saved-only").checked || savedHostels.has(hostel.id))
    && (!term || `${hostel.name || ""} ${hostel.area || ""}`.toLowerCase().includes(term))
    && (!$("area").value || hostel.area === $("area").value)
    && (!$("room-type").value || (hostel.room_type === $("room-type").value || (hostel.room_types || []).includes($("room-type").value)))
    && (!$('campus-status').value || hostel.campus_status === $('campus-status').value)
    && (!$('listing-status').value || hostel.listing_status === $('listing-status').value)
    && ((!min && max === Infinity) || (min <= max && (includeUnpricedOffCampus || (priceLow != null && priceHigh >= min && priceLow <= max))))
    && (distance >= 10 || (referenceDistance(hostel) != null && referenceDistance(hostel) <= distance))
    && (!$("water").checked || hasWater(hostel));
}
function sortedHostels() {
  const sortBy = $("sort").value;
  return visibleHostels().filter(matchesFilters).sort((a, b) => {
    const aValue = (sortBy === "price" ? (a.price_min_ngn ?? a.price_per_year_ngn ?? a.price_max_ngn) : referenceDistance(a)) ?? Infinity;
    const bValue = (sortBy === "price" ? (b.price_min_ngn ?? b.price_per_year_ngn ?? b.price_max_ngn) : referenceDistance(b)) ?? Infinity;
    return aValue - bValue;
  });
}
function popup(hostel) {
  const rooms = display(hostel.room_type, listValues(hostel.room_types) || "");
  const walk = walkEstimate(hostel);
  const availability = hostel.listing_status && hostel.listing_status !== "lead" ? `<br>Availability: ${escapeHtml(listingLabel(hostel.listing_status))}${hostel.availability_is_demo ? " (demo)" : ""}` : "";
  return `<strong>${display(hostel.name, "Unnamed listing")}</strong><br>${walk}<br>${roadEstimate(hostel)}<br>${locationText(hostel)}<br>${escapeHtml(priceText(hostel))}<br>${rooms}${availability}<br>${detailChips(hostel)}<br><span class="badge">${escapeHtml(verifiedLabel(hostel))}</span>`;
}
function card(hostel) {
  const distance = routeDistance(hostel);
  const walk = walkEstimate(hostel);
  const road = roadEstimate(hostel);
  const rooms = display(hostel.room_type, listValues(hostel.room_types) || "");
  const rating = hostel.student_rating_avg == null ? "No student rating" : `${escapeHtml(hostel.student_rating_avg)}/5 (${escapeHtml(hostel.student_rating_count || 0)})`;
  const photo = safeExternalUrl(hostel.photos?.[0]);
  const availability = hostel.listing_status && hostel.listing_status !== "lead" ? `<span>Availability: ${escapeHtml(listingLabel(hostel.listing_status))}${hostel.availability_is_demo ? " (demo)" : ""}</span>` : "";
  return `<article class="listing-card" data-listing-id="${escapeHtml(hostel.id)}">${photo ? `<img class="listing-photo" src="${escapeHtml(photo)}" alt="Photo of ${display(hostel.name, "hostel")}" loading="lazy">` : ""}<span class="badge">${escapeHtml(verifiedLabel(hostel))}</span><h3>${display(hostel.name, "Unnamed listing")}</h3><div class="travel-summary"><span class="travel-fact"><i data-lucide="footprints" aria-hidden="true"></i><span data-walk-time="${escapeHtml(hostel.id)}">${walk}</span></span><span class="travel-fact"><i data-lucide="car-front" aria-hidden="true"></i><span data-road-time="${escapeHtml(hostel.id)}">${road}</span></span></div><p>${locationText(hostel)}</p><div class="card-meta"><span>${escapeHtml(priceText(hostel))}</span>${rooms ? `<span>${rooms}</span>` : ""}<span data-road-distance="${escapeHtml(hostel.id)}">${distance}</span>${hostel.student_rating_avg != null ? `<span>Rating: ${rating}</span>` : ""}${availability}</div>${detailChips(hostel) ? `<details class="listing-details"><summary>Room &amp; facility details</summary><div class="detail-grid">${detailChips(hostel)}</div></details>` : ""}<small>Verified: ${formatDate(hostel.last_verified_at)}${hostel.verified_by ? ` - ${escapeHtml(hostel.verified_by)}` : ""}</small><div class="card-actions"><button type="button" data-save="${escapeHtml(hostel.id)}">${savedHostels.has(hostel.id) ? "Saved" : "Save"}</button><button type="button" data-compare="${escapeHtml(hostel.id)}">${comparison.has(hostel.id) ? "Remove comparison" : "Compare"}</button><button type="button" data-report="${escapeHtml(hostel.id)}">Report details</button><button class="map-focus-button" type="button" data-focus-map="${escapeHtml(hostel.id)}" ${!map || !hasCoordinates(hostel) ? 'disabled title="Map location unavailable"' : ""}><i data-lucide="map-pin" aria-hidden="true"></i>View route</button>${hostel.contact_public_business && safeExternalUrl(hostel.whatsapp) ? `<a href="${escapeHtml(safeExternalUrl(hostel.whatsapp))}" target="_blank" rel="noopener">Contact hostel</a>` : ""}</div></article>`;
}
function clearConnection() {
  if (state.connection && map) map.removeLayer(state.connection);
  state.connection = null;
  state.selectedHostelId = null;
  $("journey-panel").hidden = true;
  if (map && map.invalidateSize) map.invalidateSize();
}
function showConnection(hostel) {
  clearConnection();
  if (!map || !hostel) return;
  state.selectedHostelId = hostel.id;
  const route = roadRoutes.get(hostel.id);
  if (route) {
    state.connection = L.geoJSON(routeDisplayGeometry(hostel, route), {style: {color: "#1559d6", weight: 4, opacity: .9}}).addTo(map);

  }
  $("journey-panel").hidden = false;
  map.invalidateSize();
  $("journey-panel").innerHTML = `<strong>${escapeHtml(hostel.name)} to ${escapeHtml(referenceName(hostel))}</strong><p>${route ? `${(route.distance / 1000).toFixed(1)} km by road, ${Math.ceil(route.duration / 60)} min driving estimate, no traffic.` : "Road route not loaded yet."}</p><p>${walkEstimate(hostel)}</p>`;
  requestAnimationFrame(() => {
    if (state.selectedHostelId !== hostel.id) return;
    map.invalidateSize();
    if (state.connection) {
      map.fitBounds(state.connection.getBounds(), {padding:[32,32], maxZoom:17, animate:true, duration:.6});
    } else if (hasCoordinates(hostel)) {
      map.setView([hostel.latitude,hostel.longitude], 16, {animate:true});
    }
  });
}
function focusMarker(id) {
  const marker = state.markers.get(id);
  if (!marker || !map) return;
  setMobileView("map", false);
  $("map").scrollIntoView({ behavior: "smooth", block: "center" });
  map.invalidateSize();
  state.markers.forEach((candidate) => {
    const selected = candidate === marker;
    candidate.setOpacity(1);
    candidate.setIcon(markerIcon(selected));
  });
  showConnection(state.hostels.find((hostel) => hostel.id === id));
  marker.closePopup();

}
function render() {
  clearConnection();
  const results = sortedHostels();
  $("result-count").textContent = results.length;
  $("mobile-result-count").textContent = results.length;
  $("map-match-count").textContent = `${results.length} matching hostels`;
  $("listing-list").innerHTML = results.map(card).join("");
  $("empty-state").hidden = results.length !== 0;
  document.querySelectorAll('[data-save]').forEach(button => button.addEventListener('click', () => {
    const id = button.dataset.save; savedHostels.has(id) ? savedHostels.delete(id) : savedHostels.add(id);
    persist('nookly-saved', [...savedHostels]); render();
  }));
  document.querySelectorAll('[data-compare]').forEach(button => button.addEventListener('click', () => {
    const id = button.dataset.compare;
    if (comparison.has(id)) comparison.delete(id);
    else if (comparison.size < 3) comparison.add(id);
    else { $('planner-status').textContent = 'Compare up to 3 hostels. Remove one first.'; return; }
    updateComparison(); render();
  }));
  document.querySelectorAll('[data-report]').forEach(button => button.addEventListener('click', () => {
    setMobileView('planner', false);
    $('report-hostel').value = button.dataset.report; $('report-text').focus(); $('planner').scrollIntoView({behavior:'smooth'});
  }));
  const matchingIds = new Set(results.map((item) => item.id));
  state.markers.forEach((marker, id) => {
    marker.closePopup();
    marker.setIcon(markerIcon(false));
    marker.setOpacity(1);
    if (matchingIds.has(id)) { if (!map.hasLayer(marker)) marker.addTo(map); }
    else if (map.hasLayer(marker)) map.removeLayer(marker);
  });
  const invalidPrice = $("min-price").value !== "" && $("max-price").value !== "" && Number($("min-price").value) > Number($("max-price").value);
  $("filter-feedback").textContent = invalidPrice ? "Minimum rent must not exceed maximum rent." : "";
  document.querySelectorAll("[data-focus-map]").forEach((button) => button.addEventListener("click", () => focusMarker(button.dataset.focusMap)));
  syncRoadLayers(results);
  refreshIcons();
}
function populateFilters() {
  const values = (field) => [...new Set(visibleHostels().flatMap((item) => field === "room_type" ? [item.room_type, ...(item.room_types || [])] : [item[field]]).filter(Boolean))].sort();
  values("area").forEach((value) => $("area").insertAdjacentHTML("beforeend", `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`));
  const noRooms = values("room_type").length === 0;
  $("room-type").disabled = noRooms;
  $("water").disabled = !visibleHostels().some(hasWater);
  $("filter-availability").textContent = [noRooms ? "Room types have not been supplied yet." : "", $("water").disabled ? "No listings currently report available water." : ""].filter(Boolean).join(" ");
  values("room_type").forEach((value) => $("room-type").insertAdjacentHTML("beforeend", `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`));
}
function setupMap() {
  if (!map) return;
  if (hasCoordinates(state.gate)) {
    L.marker([state.gate.latitude, state.gate.longitude], { icon: referenceIcon("gate", "G"), zIndexOffset: 1000, title: "OAU Main Gate reference point" }).addTo(map).bindPopup(`<strong>OAU Main Gate</strong><br><span class="reference-label">Off-campus reference</span><br>${display(state.gate.source)}`);
  }
  if (hasCoordinates(state.campusReference)) {
    L.marker([state.campusReference.latitude, state.campusReference.longitude], {icon: referenceIcon("library", "L"), zIndexOffset: 1000, title:'Hezekiah Oluwasanmi Library reference point'}).addTo(map).bindPopup('<strong>Hezekiah Oluwasanmi Library</strong><br><span class="reference-label">On-campus reference</span><br>Mapped building location.');
  }
  visibleHostels().filter((hostel) => hasCoordinates(hostel)).forEach((hostel) => {
    const marker = L.marker([hostel.latitude, hostel.longitude], { icon: markerIcon(false), keyboard: true, title: hostel.name }).addTo(map).bindPopup(popup(hostel));
    marker.on("click", () => focusMarker(hostel.id));
    state.markers.set(hostel.id, marker);
  });
  resetMapView();
}
function resetMapView() {
  if (!map) return;
  render();
  const points = sortedHostels().filter(hasCoordinates).map((hostel) => [hostel.latitude, hostel.longitude]);
  if (hasCoordinates(state.gate)) points.push([state.gate.latitude, state.gate.longitude]);
  if (hasCoordinates(state.campusReference)) points.push([state.campusReference.latitude, state.campusReference.longitude]);
  if (points.length > 0) map.fitBounds(L.latLngBounds(points), { padding: [28, 28], maxZoom: 14 });
}
function referenceIcon(type, label) {
  return L.divIcon({ className: `nookly-reference-marker is-${type}`, html: `<span><i>${escapeHtml(label)}</i></span>`, iconSize: [30, 38], iconAnchor: [15, 36], popupAnchor: [0, -34] });
}
function markerIcon(selected) {
  return L.divIcon({
    className: `nookly-marker${selected ? " is-selected" : ""}`,
    html: "<span></span>",
    iconSize: [30, 38],
    iconAnchor: [15, 36],
    popupAnchor: [0, -34]
  });
}
async function loadData() {
  let hostelsLoaded = false;
  try {
    const hostelResponse = await fetch("data/hostels.json");
    if (!hostelResponse.ok) throw new Error(`hostels.json returned ${hostelResponse.status}`);
    state.hostels = await hostelResponse.json();
    if (!Array.isArray(state.hostels)) throw new Error("hostels.json must contain a JSON array");
    hostelsLoaded = true;
  } catch (error) {
    state.hostels = FALLBACK_HOSTELS;
    $("data-status").innerHTML = "<strong>Data unavailable:</strong> hostels.json could not be loaded. Run a local static server and check the data file.";
  }
  try {
    const siteResponse = await fetch("data/site_config.json");
    if (siteResponse.ok) { const config = await siteResponse.json(); state.gate = config.main_gate; state.campusReference = config.campus_reference; state.reportEndpoint = config.report_endpoint || ""; }
  } catch (error) {
    state.gate = null;
  }
  if (hostelsLoaded) {
    $("mapped-count").textContent = visibleHostels().length;
    $("area-count").textContent = new Set(visibleHostels().map((hostel) => hostel.area).filter(Boolean)).size;
    $("source-count").textContent = visibleHostels().filter((hostel) => hostel.source).length;
    const hiddenCount = state.hostels.length - visibleHostels().length;
    $("data-status").innerHTML = hiddenCount > 0
      ? `<strong>Data ready:</strong> showing ${visibleHostels().length} named records; ${hiddenCount} records are hidden by publication settings or missing names.`
      : `<strong>Data ready:</strong> showing ${visibleHostels().length} named accommodation records.`;
  }
  populateFilters(); setupMap(); render();
  initializePlanner();
  // Let the base map paint before background route requests compete for bandwidth.
  if (map && baseTiles && baseTiles.once) {
    let routesStarted = false;
    const startRoutes = () => { if (!routesStarted) { routesStarted = true; loadRoadRoutes(); } };
    baseTiles.once('load', startRoutes);
    setTimeout(startRoutes, 1500);
  } else loadRoadRoutes();
}
["search", "min-price", "max-price", "area", "room-type", "campus-status", "listing-status", "max-distance", "water", "sort"].forEach((id) => $(id).addEventListener("input", () => { $("distance-value").textContent = $("max-distance").value >= 10 ? "Any" : `${$("max-distance").value} km`; render(); }));
$("clear-filters").addEventListener("click", () => { ["search", "min-price", "max-price"].forEach((id) => $(id).value = ""); ["area", "room-type", "campus-status", "listing-status"].forEach((id) => $(id).value = ""); $("max-distance").value = 10; $("water").checked = false; $("distance-value").textContent = "Any"; $("map-search").value = ""; $("sort").value = "price"; $("saved-only").checked = false; render(); });
$("focus-map").addEventListener("click", () => { setMobileView("map", false); $("map").scrollIntoView({ behavior: "smooth", block: "center" }); if (map) map.invalidateSize(); });
$("reset-map").addEventListener("click", resetMapView);
$("reset-map").disabled = !map;
function readStored(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function persist(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { $('planner-status').textContent = 'Browser storage is unavailable; changes last only for this visit.'; return false; } }
const savedHostels = new Set(readStored('nookly-saved', []));
const comparison = new Set();
const roadRoutes = new Map();
const roadLayers = new Map();
function syncRoadLayers(results) {
  if (!map) return;
  const ids = new Set($("show-routes").checked ? results.map(h => h.id) : []);
  roadLayers.forEach((layer,id) => { if (ids.has(id)) { if (!map.hasLayer(layer)) layer.addTo(map); } else if (map.hasLayer(layer)) map.removeLayer(layer); });
}
async function loadRoadRoutes() {
  if (!map || !hasCoordinates(state.gate)) { $('route-status').textContent = 'Road routes unavailable without the map and gate coordinates.'; return; }
  const hostels = visibleHostels().filter(hasCoordinates);
  let failed = 0;
  for (const h of hostels) {
    const destination = referencePoint(h);
    if (!hasCoordinates(destination)) { failed++; continue; }
    const coordinates = `${h.longitude},${h.latitude};${destination.longitude},${destination.latitude}`;
    const key = `nookly-route-v1:${coordinates}`;
    try {
      let route = readStored(key, null);
      if (!route || Date.now() - route.savedAt > 604800000) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        try {
          const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson`, {signal:controller.signal});
          if (!response.ok) throw new Error('Route service unavailable');
          const result = await response.json();
          if (result.code !== 'Ok' || !result.routes?.[0]) throw new Error('No route');
          route = {...result.routes[0], savedAt:Date.now()};
          persist(key, route);
        } finally { clearTimeout(timeout); }
        await new Promise(resolve => setTimeout(resolve, 1100));
      }
      if (route.geometry?.type !== 'LineString' || !Array.isArray(route.geometry.coordinates) || route.geometry.coordinates.length < 2 || !Number.isFinite(route.distance) || !Number.isFinite(route.duration)) throw new Error('Invalid route');
      roadRoutes.set(h.id,route);
      if (state.selectedHostelId === h.id) showConnection(h);
      refreshTravelDetails(h);
      roadLayers.set(h.id,L.geoJSON(routeDisplayGeometry(h, route),{style:{color:'#3b75c6',weight:2,opacity:.18},interactive:false}));
      syncRoadLayers(sortedHostels());
    } catch { failed++; }
    const unavailable = failed ? `, ${failed} unavailable` : '';
    $('route-status').textContent = `${roadRoutes.size}/${hostels.length} road routes loaded${unavailable}. Driving routes from OSRM / OpenStreetMap.`;
    if (failed >= 3 && roadRoutes.size === 0) { $('route-status').textContent = 'Routing service unavailable. Try again later; no substitute lines are drawn.'; break; }
  }
}
function updateComparison() {
  const hostels = state.hostels.filter(h => comparison.has(h.id));
  $('comparison-table').innerHTML = hostels.length ? `<table><caption>Compare selected hostels</caption><thead><tr><th>Detail</th>${hostels.map(h=>`<th>${escapeHtml(h.name)}</th>`).join('')}</tr></thead><tbody>${[
    ['Price', h=>escapeHtml(priceText(h))], ['Area',h=>display(h.area,'Not supplied')], ['Room',h=>display(h.room_type,'Not supplied')], ['Water',h=>display(h.water,'Not supplied')], ['Power',h=>display(h.power_hours_estimate,'Not supplied')], ['Reference',h=>escapeHtml(referenceName(h))], ['Distance to reference',h=>referenceDistance(h) == null ? 'Not supplied' : `${escapeHtml(referenceDistance(h))} km (approx.)`], ['Status',h=>escapeHtml(listingLabel(h.listing_status))+(h.availability_is_demo?' (demo)':'')]
    ].map(([label,fn])=>`<tr><th>${label}</th>${hostels.map(h=>`<td>${fn(h)}</td>`).join('')}</tr>`).join('')}</tbody></table>` : '<p>Select Compare on up to three hostel cards.</p>';
  $('planner-status').textContent = `${comparison.size}/3 hostels selected for comparison.`;
}
function budgetTotal(rent, fees, fare, days) { return rent + fees + fare * days; }
function initializePlanner() {
  $('report-hostel').innerHTML = '<option value="">Choose a hostel</option>' + visibleHostels().map(h=>`<option value="${escapeHtml(h.id)}">${escapeHtml(h.name)}</option>`).join('');
  updateComparison();
}
$('saved-only').addEventListener('input', render);
$('budget-form').addEventListener('input', () => {
  const values = ['budget-rent','budget-fees','budget-fare','budget-days'].map(id=>Number($(id).value));
  $('budget-total').textContent = values.every(v=>Number.isFinite(v)&&v>=0) ? `Estimated total: NGN ${budgetTotal(...values).toLocaleString()}` : 'Enter non-negative amounts.';
});
$('budget-form').addEventListener('submit', event=>event.preventDefault());
$('report-form').addEventListener('submit', async event => {
  event.preventDefault();
  const description = $('report-text').value.trim();
  if (!description) { $('report-status').textContent = 'Describe the incorrect information first.'; $('report-text').focus(); return; }
  const selectedHostelId = $('report-hostel').value.trim();
  const hostel = state.hostels.find(h => h.id === selectedHostelId);
  if (!hostel) { $('report-status').textContent = 'Choose the hostel you are reporting first.'; $('report-hostel').focus(); return; }
  const report = {
    _subject: `Nookly correction: ${hostel.name}`,
    hostel_id: hostel.id,
    hostel_name: hostel.name,
    correction: description,
    submitted_at: new Date().toISOString()
  };
  if (!state.reportEndpoint) { $('report-status').textContent = 'Report delivery is not connected yet.'; return; }
  $('report-status').textContent = 'Sending report to the project team...';
  try {
    const response = await fetch(state.reportEndpoint, {
      method:'POST',
      headers:{'Content-Type':'application/json','Accept':'application/json'},
      body:JSON.stringify(Object.fromEntries(Object.entries(report).filter(([, value]) => String(value || '').trim())))
    });
    if (!response.ok) throw new Error('Report delivery failed');
    const reports = readStored('nookly-reports', []);
    reports.push(report);
    persist('nookly-reports', reports);
    $('report-status').textContent = 'Report sent to the project team.';
    $('report-text').value = '';
    $('report-hostel').value = '';
  } catch(error) {
    $('report-status').textContent = 'Could not send report. Please try again.';
  }
});

$('show-routes').addEventListener('input', () => syncRoadLayers(sortedHostels()));
$('retry-tiles').addEventListener('click', retryMapTiles);
$('close-route').addEventListener('click', () => { clearConnection(); state.markers.forEach(marker => marker.setIcon(markerIcon(false))); });
if (map && typeof ResizeObserver !== 'undefined') new ResizeObserver(() => map.invalidateSize()).observe($('map'));
function setMobileView(view, scroll = true) {
  if (!document.body) return;
  const views = ['home', 'map', 'hostels', 'filters', 'planner'];
  if (!views.includes(view)) return;
  views.forEach(name => {
    document.body.classList.toggle(`view-${name}`, name === view);
    document.body.classList.toggle(`mobile-${name}`, name === view);
  });
  document.querySelectorAll('[data-mobile-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mobileView === view)));
  const hash = view === 'hostels' ? '#finder' : `#${view}`;
  if (window.location && window.location.hash !== hash) window.history.pushState(null, '', hash);
  document.querySelectorAll('.nav-links a').forEach(link => {
    if (link.getAttribute('href') === hash) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  if (map && view === 'map') requestAnimationFrame(() => {
    map.invalidateSize();
    if (state.selectedHostelId) return;
    const points = sortedHostels().filter(hasCoordinates).map(h => [h.latitude,h.longitude]);
    if (hasCoordinates(state.gate)) points.push([state.gate.latitude,state.gate.longitude]);
    if (hasCoordinates(state.campusReference)) points.push([state.campusReference.latitude,state.campusReference.longitude]);
    if (points.length) map.fitBounds(L.latLngBounds(points), {padding:[28,28],maxZoom:14});
  });
  if (scroll && window.scrollTo) window.scrollTo({top:0,behavior:'smooth'});
}
function navigateHash() {
  const hash = window.location.hash;
  setMobileView(hash === '#finder' ? 'hostels' : hash === '#top' || hash === '#how-it-works' ? 'home' : ['#map','#planner','#filters'].includes(hash) ? hash.slice(1) : 'home', false);
}
document.querySelectorAll('[data-mobile-view]').forEach(button => button.addEventListener('click', () => setMobileView(button.dataset.mobileView)));
document.querySelectorAll('a[href^="#"]').forEach(link => link.addEventListener('click', event => {
  const target = link.getAttribute('href');
  const view = {'#home':'home','#top':'home','#finder':'hostels','#map':'map','#planner':'planner','#how-it-works':'home'}[target];
  if (view) { event.preventDefault(); setMobileView(view); }
}));
if (window.addEventListener) { window.addEventListener('popstate', navigateHash); window.addEventListener('hashchange', navigateHash); navigateHash(); }
$('map-search').addEventListener('input', () => { $('search').value = $('map-search').value; render(); });
$('search').addEventListener('input', () => { $('map-search').value = $('search').value; });
loadData();
