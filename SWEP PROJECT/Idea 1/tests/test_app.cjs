const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const elements = new Map();
const el = id => {
  if (!elements.has(id)) elements.set(id, { value: '', checked: false, textContent: '', addEventListener(event, fn) { this[event] = fn; }, insertAdjacentHTML() {} });
  return elements.get(id);
};
el('max-distance').value = '10';
const context = { document: { getElementById: el, querySelectorAll: () => [] }, window: {} };
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, 'app.js'), 'utf8').replace(/loadData\(\);\s*$/, ''), context);
let count = 0;
function check(name, expression) { assert.ok(vm.runInContext(expression, context), name); console.log('PASS ' + name); count++; }
check('Missing map library does not stop listings', 'map === null');
check('Escapes HTML including ampersands', `!detailChips({payment_terms:'& <img src=x onerror=alert(1)>'}).includes('<img')`);
check('Escapes facility HTML', `!detailChips({facilities:{kitchen:'& <script>bad</script>'}}).includes('<script>')`);
check('Rejects invalid coordinates', `!hasCoordinates({latitude:100,longitude:4}) && !hasCoordinates(null)`);
check('Location text avoids duplicate area and address', `locationText({campus_status:'on_campus',area:'On campus',address_description:'On campus - male undergraduate hall'})==='On campus - male undergraduate hall' && locationText({campus_status:'off_campus',area:'Oroki Street',address_description:'Plot 124, Oroki Street, Koiwo Layout, Ile-Ife'})==='Off campus - Plot 124, Oroki Street, Koiwo Layout, Ile-Ife'`);
check('Honors publication settings', `state.hostels=[{id:'x',name:'Hidden',visible_on_site:false},null]; visibleHostels().length===0`);
check('Matches price intervals', `$('min-price').value='100'; $('max-price').value='200'; matchesFilters({price_min_ngn:120,price_max_ngn:180})`);
check('Rejects inverted price interval', `$('min-price').value='300'; !matchesFilters({price_min_ngn:120,price_max_ngn:180})`);
check('Zero maximum is respected', `$('min-price').value=''; $('max-price').value='0'; !matchesFilters({price_per_year_ngn:100})`);
check('Matches multiple room types', `$('max-price').value=''; $('room-type').value='Single'; matchesFilters({room_types:['Single']})`);
check('Clear resets label and sort', `$('distance-value').textContent='2 km'; $('sort').value='distance'; $('clear-filters').click(); $('distance-value').textContent==='Any' && $('sort').value==='price'`);
check('Collection date is not verification', `!card({name:'Lead',date_collected:'2026-10-03'}).includes('Verified: 2026-10-03')`);
check('Keeps verified badge', `verifiedLabel({campus_status:'on_campus'})==='Verified' && verifiedLabel({campus_status:'off_campus'})==='Verified'`);
check('No fabricated driving time', `roadEstimate({walk_minutes_estimate:20})==='Driving time pending route'`);
check('Disables unavailable map actions', `card({name:'Lead'}).includes('disabled title="Map location unavailable"')`);
check('Explains empty filters', `state.hostels=[{name:'Lead'}]; populateFilters(); $('room-type').disabled && $('water').disabled && $('filter-availability').textContent.includes('not been supplied')`);
const data = JSON.parse(fs.readFileSync(path.join(root, 'data/hostels.json'), 'utf8'));
assert.ok(data.some(item => item.visible_on_site));
assert.equal(data.filter(item => item.visible_on_site).length, data.filter(item => typeof item.name === 'string' && item.name.trim()).length);
assert.ok(!data.some(item => item.campus_status === 'on_campus' && item.price_per_year_ngn === 30000));
assert.ok(data.some(item => item.name === 'Akintola'));
check('Calculated road estimate', `roadEstimate({distance_to_gate_km:5})==='Driving time pending route'`);
check('Updated room and water details', `card({room_type:'shared room',water:'Intermittent'}).includes('Intermittent')`);
const active = new Set();
context.mapStub = { hasLayer: marker => active.has(marker), removeLayer: marker => active.delete(marker) };
// Test the real renderer with a map stub in a separate context.
const mapContext = {document: context.document, window: {L:true}, L:{map:()=>({setView(){return this},hasLayer:context.mapStub.hasLayer,removeLayer:context.mapStub.removeLayer}),tileLayer:()=>({addTo(){}}),divIcon: x=>x}};
vm.createContext(mapContext);
vm.runInContext(fs.readFileSync(path.join(root,'app.js'),'utf8').replace(/loadData\(\);\s*$/,''),mapContext);
mapContext.makeMarker = () => { const marker={closePopup(){},setIcon(){},setOpacity(){},addTo(){active.add(marker)}}; active.add(marker); return marker; };
vm.runInContext(`state.hostels=[{id:'shown',name:'Shown'},{id:'hidden',name:'Hidden'}]; state.markers.set('shown',makeMarker()); state.markers.set('hidden',makeMarker()); $('search').value='Shown'; render();`,mapContext);
assert.equal(active.size,1);
vm.runInContext(`$('clear-filters').click()`,mapContext);
assert.equal(active.size,2);
console.log(`${count + 3} checks passed`);

assert.equal(data.filter(h => h.campus_status === "off_campus" && h.listing_status === "available").length, Math.round(data.filter(h => h.campus_status === "off_campus").length * .7));
assert.ok(data.filter(h => h.campus_status === "on_campus").every(h => h.listing_status === "available_on_ballot"));
check("Ballot status filter", `$("listing-status").value="available_on_ballot"; matchesFilters({listing_status:"available_on_ballot"}) && !matchesFilters({listing_status:"available"})`);
check("Demo label", `card({name:"Demo",listing_status:"available",availability_is_demo:true}).includes("Available (demo)")`);

check('Unpriced off-campus listings remain in requested budget search', `$('clear-filters').click(); $('min-price').value='150000'; $('max-price').value='800000'; matchesFilters({campus_status:'off_campus'})`);
check('Known prices still determine budget matches', `!matchesFilters({campus_status:'off_campus',price_per_year_ngn:900000}) && matchesFilters({campus_status:'off_campus',price_per_year_ngn:200000})`);
check('Search fallback never changes card price', `priceText({campus_status:'off_campus'})==='Price on enquiry'`);
check('Fallback excludes other locations and out-of-range budgets', `!matchesFilters({campus_status:'on_campus'}) && ($('min-price').value='850000', $('max-price').value='900000', !matchesFilters({campus_status:'off_campus'}))`);

check('Budget includes rent fees and return travel', `budgetTotal(150000,20000,1000,100)===270000`);
check('Saved-only filter', `$('clear-filters').click(); savedHostels.add('saved'); $('saved-only').checked=true; matchesFilters({id:'saved'}) && !matchesFilters({id:'other'})`);
check('Comparison renders selected details safely', `state.hostels=[{id:'compare',name:'<script>bad</script>',water:'Reported'}]; comparison.add('compare'); updateComparison(); $('comparison-table').innerHTML.includes('&lt;script&gt;') && !$('comparison-table').innerHTML.includes('<script>')`);
mapContext.localStorage = { getItem: () => JSON.stringify({savedAt:Date.now(),distance:1500,duration:300,geometry:{type:'LineString',coordinates:[[4.5,7.5],[4.51,7.505],[4.52,7.51]]}}) };
mapContext.L.geoJSON = geometry => ({geometry,addTo(){active.add(this);return this}});
vm.runInContext(`state.gate={latitude:7.51,longitude:4.52}; state.hostels=[{id:'road-test',name:'Road test',latitude:7.5,longitude:4.5}]; $('clear-filters').click();`,mapContext);
vm.runInContext('loadRoadRoutes()',mapContext).then(() => {
 assert.equal(vm.runInContext('roadRoutes.size',mapContext),1);
 assert.equal(vm.runInContext("roadRoutes.get('road-test').geometry.coordinates.length",mapContext),3);
 assert.equal(vm.runInContext('roadLayers.size',mapContext),1);
 console.log('PASS automatic cached road geometry loading');
}).catch(error=>{console.error(error);process.exitCode=1});

check('Walk estimate uses direct-distance allowance', `walkEstimate({distance_to_gate_km:4}).includes('78 min walk estimate')`);
check('Walk estimate rejects unknown distances', `walkEstimate({})==='Walk estimate unavailable'`);
check('Walk estimate uses loaded road distance', `roadRoutes.set('walk-test',{distance:4000,duration:600}); walkEstimate({id:'walk-test',distance_to_gate_km:2}).includes('60 min walk estimate')`);
check('Route display reaches exact reference marker', `state.gate={latitude:7.52,longitude:4.53}; JSON.stringify(routeDisplayGeometry({campus_status:'off_campus'}, {geometry:{type:'LineString',coordinates:[[4.5,7.5],[4.52,7.51]]}}).coordinates.at(-1))==='[4.53,7.52]'`);
check('Cards have no Google Maps links', `!card({name:'Test',distance_to_gate_km:1}).includes('google.com')`);

check("Campus rent period", `priceText({campus_status:"on_campus",price_per_year_ngn:50000}).endsWith(" / session")`);
check("Off-campus range period", `priceText({campus_status:"off_campus",price_min_ngn:150000,price_max_ngn:800000}).endsWith(" / year")`);
assert.ok(data.every(h => !h.availability_is_demo));

check("Verification dates use day/month/year", `formatDate("2026-10-03")==="03/10/2026" && formatDate(null)==="Date not recorded"`);
