# Galli Maps Campaign Dashboard · Election Atlas (build 13)

A candidate dashboard for the Local Level Election. It combines two sources: the Galli campaign tool (real admin
boundaries, Census 2021, real building footprints, health facilities, household visit tracking on the Galli Maps basemap)
and the Nepal Local Election Atlas (2017 and 2022 local results, 2022 registered voters, 2026 House results, Census reach data).

## Run it

Double-click `start.bat`, or in this folder run:

    py serve.py

then open http://localhost:8080. It must be served over http because the page fetches `./data`.
Internet is needed for the Galli Maps tiles, Leaflet (cdnjs) and Google Fonts.

## Files

    index.html            page structure (login, filters, map, sidebar, report modal)
    css/styles.css        all styling, light and dark theme tokens
    js/app.js             all behaviour (filters, map, households, POIs, demographics, report)
    data/hier.json        provinces, districts, municipalities, wards: Census 2021 totals by sex and 5-year age group
    data/bounds.json      province and district outlines
    data/dist/<code>.json municipality outlines per district
    data/mun/<id>.json    ward polygons and health POIs per municipality
    data/bld/<wardId>.json building footprints per ward (compact delta-encoded)
    data/elections.json   real election results, voters and census reach for 753 local levels + 2026 House by district
    tools/                Python scripts that rebuild data/ from the source GeoJSON files and the Election Atlas page
    _backup_v11/          the build 11 index.html, styles.css and app.js before the merge
    start.bat             starts serve.py (no-cache local server on port 8080)
    serve.py              local server

## Rebuilding the data

Needs Python 3 with `numpy` and `shapely`. Edit the source paths at the top of each script, then:

    py tools/build_boundaries.py     # boundaries, demographics, health POIs
    py tools/build_buildings.py      # building footprints (needs the step above first)
    py tools/add_counts.py           # per-ward building and health-facility counts into hier.json
    py tools/build_elections.py <election-atlas.html>   # data/elections.json, joined to municipalities by name, ward count and population

## What is real and what is a placeholder

| Item | Status |
|---|---|
| Province, district, municipality and ward boundaries | Real (boundaries.geojson) |
| Population by sex and age | Real, Census 2021 |
| Building footprints | Real (building_election.geojson). 9.46 million buildings; 6,771 wards have footprints. Buildings of every ward in view load as you zoom in (zoom 13 and closer), at any filter level. |
| Health facilities | Real (health.geojson). Other POI categories have no data yet. |
| Visited / not visited status | Demo placeholder, not saved. No owner names or household details are used; only status and an optional note per building. |
| Past election results | Sample until `data/election_results.csv` is filled |
| Tole filter | Disabled, no tole boundaries in the data |
| Login and OTP | Mockup only |

## Look and layout (build 13)

Follows the Election Atlas: header with the election calendar, one control card (layer buttons, province/district/municipality/ward, search),
the map on the left and a reading panel on the right, then a data/caveats/sources footer. Cool grey page, white bordered cards,
navy accent, Martel and Mukta type, light and dark themes (follows the system setting). Under 980 px the panel stacks below the map.

## What the merged dashboard adds

- **Map colours** (buttons above the map, legend below it): 2022 winner, 2017 winner, held or flipped, close races, 2026 House, voters per 100 adults.
  National view colours the 77 districts, province view the districts, district view the municipalities.
- **Election results** (sidebar): timeline tabs 2017, 2022, 2026 House and 2027 next, at every level.
  Municipality: all 2017 mayor and deputy candidates with votes and ward-chair winners; 2022 top two, by-elections and source flags.
  District, province, nation: seats won by party, flips since 2017, 2026 proportional vote and constituency winners.
  2027 next: closest 2022 races (click to jump), lowest registered voters per 100 adults, new voters by 2027, and ward visit coverage.
- **Voters and reach**: 2022 registered voters (male and female), adults, people abroad, smartphone, internet, TV, radio, literacy.
- Demographics now use census adult and household counts at municipality level and above.

## What is real and what is not (election layer)

| Item | Status |
|---|---|
| 2017 results (all mayor and deputy candidates, ward-chair winners by party) | Real, Election Commission via the Atlas |
| 2022 results | Real, Kantipur via the Atlas. Top two candidates only. Benighat Rorang is missing in the source |
| 2022 registered voters | Real, from the same pages. Some local levels have no male/female split or were flagged by the Atlas |
| 2026 House | Real, by district. Constituencies do not follow local-level boundaries, so no municipality figures |
| 2021 census (adults, households, abroad, reach, literacy) | Real, per local level. Not per ward |
| Ward-level election results | Not in the dashboard yet. The Atlas has 2017 ward-chair winners per ward in separate files that were not part of the page that was used |
| 22 parks, reserves and Kalapani | No election data (not local governments) |

Party tallies can differ by one or two from official totals. Census counts usual residents only, so voters per 100 adults
can pass 100. Visit status, login and exports are still demo.

## Build 14 changes

- Simpler layout: one filter bar, one "Colour by" menu, and a sidebar with three tabs (Results, Voters, Visits). The data notes moved to a short "About the data" fold at the bottom.
- Results: a ward or municipality shows the mayor/chair and deputy/vice-chair together, with every candidate the data holds. A district lists the mayor and deputy of each local level and links to its full result.
- Voters: registered voters (2022) by gender, and people of voting age by gender and age group (18-29, 30-39, 40-49, 50-59, 60+).
- Buildings button on the map hides or shows the building layer.
- Select button (ward view): draw freehand around houses, then mark them all visited or not visited, or plan a route. Undo is offered after a bulk change.
- Route planning: nearest-neighbour order improved with 2-opt, up to 80 stops, walking distance and time estimate, per-stop visited toggle, "start here", reverse, CSV download, and a Google Maps link for the first 10 stops.
- Field notes export (CSV or print to PDF) has a "Contributed by" section: name, role, and the number of entries per contributor. Each row also has a Contributed by column.
- Visits, notes and the contributor name are saved in this browser (localStorage). They are not shared between devices.

Data limits: the source holds 2022 top-two candidates only, and 2017 up to four per post (the rest shown as one line with their combined votes). Ward-level election results are not in the data.

## Build 15 changes

- `data/results22.json`: 2022 results for every ward post (chair, members, women members, Dalit women members) with every candidate, votes and party, for 752 local levels, plus mayor/chair and deputy (top two as published) and eligible voters. A ward shows its own chair and member results; a municipality shows a ward-chair tally and colours its wards by the winning chair's party.
- Rebuild: `py tools/scrape_ekantipur.py` (run it inside a folder; it writes `out/`), then `py tools/build_results22.py <out folder>`. The scraper reads localelection.ekantipur.com (its robots.txt has no disallow rules), uses 3 workers with delays, and takes about 20 minutes.
- Route planning uses the Galli Maps road-line tiles (`gtiles.gallimap.com .../roadline_roadline/{z}/{x}/{y}`, protobuf). The tiles are decoded in the browser into a road graph, houses are snapped to the nearest road, and stops are ordered by road distance (nearest neighbour plus 2-opt). The route is drawn along the roads, and distance and time use road length. If a ward has no road data, it falls back to straight lines. A Roads button on the map shows the road layer.
- The road tile server must allow the origin the dashboard is served from (it allows localhost; for another domain, ask Galli Maps to add it).

## Build 16 changes

- Places (POIs) now come from the Galli Maps place tiles (`map-init.gallimap.com/data/galli-poi/{z}/{x}/{y}.pbf`, listed in `gtiles.gallimap.com/styles/data/galli-tile.json` and the Galli light style). Press the pin button and zoom to street level (14+). Places are grouped into Health, Education, Worship, Offices, Food, Hotels, Shops, Banks and Other. The list button opens a panel with chips to turn each group on or off and the nearest 100 places in view. Health, Education, Worship and Offices are on by default. Finer-ranked places appear as you zoom in, following the Galli style. The old health-facility markers were replaced by this layer.

## Build 17 changes

- Directions open in Galli Maps (`map.gallimap.com/?data=...`, the same share-link format the Galli Maps web app creates) instead of Google Maps. Galli share links hold two points, so the Galli Maps button opens stop 1 to stop 2, and the arrow on any stop opens the leg from the previous stop to that stop.
- Phone layout (width 768 px or less): the map fills the screen and the results sit in a bottom sheet that you drag or tap between peek, half and full. Filters scroll sideways, controls are larger, the sheet shrinks while you draw a selection, and the page can be added to the home screen (`manifest.json`).
- A My location button on the map: routes start from your location when it is on (needs https or localhost).

## Build 18 changes

- New **Places** tab (also opened by the list button on the map): counts of places in the map view by group with bars and shares (tap a bar to show or hide that group on the map), the most common types as chips (tap to filter), a name/address filter, and a clickable list sorted by distance from you (or the map centre). Tapping a place zooms to it and opens its card. "Download list" saves the filtered list as CSV. The old floating places panel was removed.

## Build 20 changes (phone)

- Less clutter: the four filters, Colour by and search now sit behind one area button at the top. Tap it to change area, then Done. Zoom buttons and the places-list button are hidden on phones (pinch to zoom; places are in the Places tab). The legend is one row of chips under the area tag. The panel starts small on the country view and opens to half height once you pick a municipality, and it clears the browser's bottom toolbar.

## Build 21 changes

- **Click to switch area:** click or tap any ward on the map to jump to it, with no filter reset. Click a ward of a neighbouring municipality and it opens that municipality's ward directly. At district and country level, click inside any area (even in Outlines mode).
- **Places by boundary:** with places on, the layer shows everything inside the selected ward, municipality or district boundary (not just the screen), at any zoom, and the Places tab counts and lists only those. For very large areas it falls back to the map view at street zoom.
- **Export by selection or boundary:** the field notes export has an Area choice: selected houses, this ward, the whole municipality or the whole district. Selected houses also have an Export button in the selection bar, and municipality and district views have an Export button in the Visits tab. For several wards, the export lists houses with a saved visit or note (read from this browser) and adds a Municipality column.
