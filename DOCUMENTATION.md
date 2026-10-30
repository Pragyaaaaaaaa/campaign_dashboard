# Galli Maps Campaign Dashboard: documentation

Version: build 21 · Date: 30 October 2026

## 1. What it is

A web dashboard for candidates in Nepal's Local Level Election. It lets a candidate pick a province, district, municipality and ward, then see who lives there, who voted and how, which places are nearby, and which buildings have been visited. It runs entirely in the browser on top of the Galli Maps basemap. There is no server code: a small static file server and a folder of JSON files are all it needs.

Sections 4 to 6 state exactly which parts use real data, which are calculated and which are still placeholders.

### The original brief and where each requirement lives

| Requirement | Where it is in the dashboard | State |
|---|---|---|
| 1. Login with mobile number, OTP, one active device | Login screen and user menu | Mockup only. Any 6 digits pass. No account system, no real session control. |
| 2. Filter by province, municipality, ward, tole | Filter bar (also district). Tole is disabled | Province, district, municipality, ward are real. Tole has no data. |
| 3. Demographics: population, age groups, gender | Sidebar, Voters tab, plus population on every level | Real (Census 2021) |
| 4. Ward POIs: filter by category, list, map | Places tab and map pin button | Real, from Galli Maps place tiles |
| 5. Household visit tracking, colour coding, remarks, reports, progress | Map buildings, building card, Visits tab, field-notes export | Real building footprints. Visit status is saved in the browser only. |
| 6. Past election results | Results tab (2017, 2022, 2026 House) | Real, from the sources in section 4 |

## 2. How to run it

1. Unzip the folder.
2. Double-click `start.bat`, or run `py serve.py` in the folder.
3. Open the address it prints (normally http://localhost:8080). It picks the next free port if 8080 is busy.
4. Press Ctrl+Shift+R after replacing an older copy.

The page fetches files from `data/`, so opening `index.html` straight from disk does not work. If the page looks out of date, stop any older server, unzip the latest package into a new folder, and hard-refresh the browser.

Needs internet for: the Galli Maps tiles, Leaflet and Leaflet.VectorGrid (from cdnjs and unpkg), and Google Fonts (Martel, Mukta).

Python 3 is needed only for `serve.py` and for rebuilding data (section 7).

## 3. How it is built

| Layer | What it uses |
|---|---|
| Page | One HTML file, one stylesheet (`css/styles.css`), one script (`js/app.js`, about 1,100 lines). No framework and no build step. |
| Map | Leaflet 1.9.4, Leaflet.VectorGrid 1.3.0 for the vector place and road tiles. Canvas rendering for buildings. |
| Basemap | Galli Maps light style, raster tiles |
| Data | JSON files in `data/`, loaded on demand and cached in memory |
| Storage | `localStorage` in the browser: visit status, notes, field answers, contributor name |
| Hosting | Any static host. `.nojekyll` and `manifest.json` are included so it can sit on GitHub Pages and be added to a phone home screen. |
| Theme and fonts | Light and dark themes (follow the system setting), Martel for headings, Mukta for text |

Layout follows the Nepal Local Election Atlas: filter bar on top, map on the left, reading panel on the right (a bottom sheet on phones, 768 px and narrower).

## 4. Data sources

| Data | Source | Year | Used for |
|---|---|---|---|
| Province, district, municipality and ward boundaries; Census population by sex and 5-year age group | `boundaries.geojson` supplied by Galli Maps (EPSG:3857). Every level has its own polygons and Census 2021 counts: 7 provinces, 77 districts, 776 municipality polygons (753 local levels plus parks, reserves and Kalapani) and about 6,785 wards. National total 29,164,578. | Census 2021 | Boundaries, demographics, age pyramids and voting-age estimates |
| Building footprints | `building_election.geojson` supplied by Galli Maps. 5.8 GB, 9,532,000 buildings | Galli Maps layer | Clickable buildings and visit tracking |
| Health facilities | `health.geojson` supplied by Galli Maps. 28,175 points | Galli Maps layer | Health POIs |
| Other places (education, worship, offices, food, shops, banks) | Galli Maps vector place tiles `map-init.gallimap.com/data/galli-poi/{z}/{x}/{y}.pbf` | Live | Places tab and map |
| Roads for route planning | Galli Maps road-line tiles `gtiles.gallimap.com/api/v1/mapdisplay/map/roadline_roadline/{z}/{x}/{y}` | Live | Walking routes |
| 2017 local results (all mayor and deputy candidates, ward-chair winners by party) and 2022 top-two results, 2022 registered voters, 2021 Census reach data (smartphone, internet, TV, radio, literacy, people abroad), 2026 House results by district | The Nepal Local Election Atlas page (its embedded data), originally from the Election Commission and Kantipur | 2017, 2022, 2026 | `data/elections.json` |
| 2022 ward-level results: chair, members, women members, Dalit women members, every candidate with votes and party; eligible voters per local level | Kantipur's local election site, collected with `tools/scrape_ekantipur.py` (the site's robots.txt has no disallow rules; 3 workers with delays, about 20 minutes) | 2022 | `data/results22.json` (752 local levels) |
| Final voter roll 2083: male, female, other, total voters and polling places for provinces, districts and 753 local levels | Election Commission notice of 16 Oct 2026 (a 54-page PDF), found through the commission's public API at `election.gov.np/admin/public/api/resources/notice`. A copy is in `sources/`. | Roll as of 15 Bhadra 2083 | `data/roll83.json` |
| 2026 House of Representatives official totals: voters, votes cast, valid votes, proportional seats | Election Commission press release of 2082/11/28 (image in `sources/`) | March 2026 | National results card and turnout history |
| National turnout 1991 to 2022 | Ratopati's turnout comparison (1991 to 2017) and Onlinekhabar (2022 House) | Various | Turnout history chart |
| Final roll changes (added 430,352, removed 203,586, deaths 45,322) | Ratopati and Nepal News reports of the commission's statement | Oct 2026 | National voter roll card |

### Source files that are not in the zip
`boundaries.geojson`, `building_election.geojson` and `health.geojson` are too large to ship. The dashboard only needs the processed files in `data/`. Keep the originals if you want to rebuild.

## 5. Methods

### 5.1 Boundaries (`tools/build_boundaries.py`)
- Coordinates are converted from Web Mercator (EPSG:3857) to longitude and latitude with the inverse spherical formula.
- Each level is simplified with a different tolerance so files stay small: provinces 0.004°, districts 0.002°, municipalities 0.0003°, wards 0.00004° (about 4 m). Coordinates are rounded to 5 decimals.
- Output: `bounds.json` (provinces and districts), `dist/<code>.json` (municipality outlines per district), `mun/<id>.json` (ward polygons and health POIs per municipality), `hier.json` (names, codes, bounding boxes and Census counts for every unit).
- Municipality names are not unique across districts, so a municipality is identified by its id and shown with its district.
- Ward rows that belong to parks and reserves (not local governments) are skipped.

### 5.2 Building footprints (`tools/build_buildings.py`)
- The 5.8 GB file is read one building per line, so memory stays low.
- Each building is reduced to its first ring, converted to longitude and latitude, simplified if it has more than 8 corners, and stored as integer offsets from its first corner (units of 0.000001°, about 11 cm). This makes each ward file small and fast to decode.
- A building belongs to the ward that contains its centre. Buildings that fall just outside every ward outline are attached to the nearest ward within about 50 m. A final check found 73,614 buildings (0.8%) outside every ward and not shown. 199 buildings have several parts and only the first is kept.
- Result: 9,458,446 buildings in 6,771 wards, 421 MB in `data/bld/<wardId>.json`. Ward files are loaded on demand: the selected ward fully, and every other ward in view faintly (from zoom 13, at any filter level, capped at about 250,000 buildings in memory).
- One shared canvas draws all buildings. A second canvas would sit on top and swallow clicks, so all building layers use the same one, with a 6 px click margin.

### 5.3 Counts per level (`tools/add_counts.py`)
Adds building and health-facility counts to every ward in `hier.json`, so province, district and municipality views can show totals without loading building files.

### 5.4 Demographics
- Population, male/female and 5-year age groups come straight from the Census 2021 fields.
- Age bands shown: 0 to 14, 15 to 24, 25 to 39, 40 to 59, 60 and over.
- Voting age (18 and over) at ward level is an estimate: 18 and 19 year-olds are taken as two fifths of the 15 to 19 band. At municipality level and above the Census adult count is used. Households are estimated at 4.4 people each where no household count exists.
- A population pyramid is not shown in this release; the age bands and gender split carry the same information.

### 5.5 Election data join (`tools/build_elections.py`)
The Atlas and the dashboard name municipalities differently (Makwanpur / Makawanpur, Tanahun / Tanahu, spelling variants). Rows are joined in two passes: district name, then municipality name with ward count and Census population as tie-breakers; then a second pass on identical 2021 population for renamed municipalities. 753 of 775 municipality polygons are joined; the 22 parks, reserves and Kalapani have no election data. Party tallies can differ by one or two from official totals.

### 5.6 2022 ward results (`tools/scrape_ekantipur.py`, `tools/build_results22.py`)
Per local level, every ward post is stored with all candidates, votes and party, plus eligible voters. A scraped page is matched to a municipality by name, ward count and the mayor winner's vote count. 752 local levels are joined; Benighat Rorang is missing in the source.

### 5.7 Final voter roll 2083 (`tools/build_roll83.py`)
- The PDF has three tables: provinces, districts, local levels. Counts read cleanly, but the Nepali names use a font that cannot be decoded, so names are not used.
- Local levels are grouped into districts by adding their totals until they equal each district total. A PDF district is matched to a dashboard district by the sorted sizes of its local levels (totals alone are ambiguous between districts of similar size). Inside a district, local levels are matched by size, using Census adults blended with the 2022 voter count.
- Checks: province, district and national totals match the PDF exactly; local levels sum to 19,091,375; the median local level is 5.9% above its 2022 voter count; none is more than 40% below or 70% above it. Two local levels of similar size inside one district could in principle be swapped.

### 5.8 Turnout
- **2022 local turnout** is calculated, not published: valid ward-chair votes (all candidates) divided by the eligible voters for that local level. Invalid ballots are not in the source, so true turnout is slightly higher. National result 65.1% across 738 local levels. 14 local levels are left out because their source totals do not add up (under 30% or over 100%). It is shown from municipality level upward, not for wards, because eligible voters are published per local level.
- **2026 House turnout** is votes cast divided by the 18,903,689 registered voters from the press release: 59.08% direct, 59.67% proportional. Some reports and Wikipedia quote 58.07%; the commission's own counts do not give that.

### 5.9 Places
POIs come from the Galli Maps place tiles, decoded in the browser, grouped into Health, Education, Worship, Offices, Food, Hotels, Shops, Banks and Other. They appear from zoom 14. The Places tab counts places in the current view by group, lets you filter by group, type or name, sorts by distance from your location or the map centre, and downloads the filtered list as CSV.

### 5.10 Household visit tracking
- Every building is a clickable polygon: green for visited, orange for not visited. A legend toggles all, visited or not visited.
- Tapping a building opens a card with the visit toggle, field questions (below), a free note, and Add to route.
- Select button (ward view): draw freehand around houses, then mark them all visited or not visited. Undo is offered afterwards.
- Progress card: houses, visited, remaining, coverage %.
- Visit status, notes, answers and the contributor's name are saved in the browser, per ward (`localStorage`, key `gm_visits_<wardId>`). They are not shared between devices or people.
- **No owner names or household details are collected.** Only status, counts and choices.

### 5.11 Field questions (build 21)
Asked at every building, answers are numbers or choices:
people living here, men, women, other gender, children under 18, adults 18 to 59, seniors 60 and over, registered voters, adults not registered, members living abroad, what the building is used for (home, shop or business, home and shop, institution, vacant), biggest concern (roads, drinking water, electricity, health care, education, jobs, waste and sanitation, safety, other), and a follow-up flag. A warning appears when the groups add up to more than the people counted.
They are exported as columns in the field-notes CSV and print report, summarised at the top of the report (people counted, gender and age shares, voters, abroad, concerns, follow-ups) and totalled in the Visits tab.

### 5.12 Route planning
House locations are snapped to the nearest road in the Galli Maps road-line tiles, which are decoded in the browser into a road graph. Stops are ordered by road distance with nearest neighbour then 2-opt, up to 80 stops, and the route is drawn along the roads with distance and walking time. If a ward has no road data, straight lines are used. Directions open in Galli Maps (`map.gallimap.com/?data=...`), which holds two points per link, so the first button opens stop 1 to stop 2 and each stop has its own leg link. The road tile server must allow the origin the dashboard is served from; it allows localhost, and another domain must be added by Galli Maps. A My location button starts routes from the user's position (needs https or localhost).

### 5.13 Field-notes export
CSV or print-to-PDF. The report has a "Contributed by" section (name and role, entries per contributor), a summary block, then one row per household with the columns: Building ID, Ward, Status, Visit date, Note, Contributed by, the ten counts, building use, biggest concern and follow-up.

## 6. What is real and what is not

| Item | Status |
|---|---|
| Boundaries, Census 2021 demographics | Real |
| Building footprints | Real. 99.2% of the file is shown. |
| Health facilities and Galli Maps places | Real |
| 2017 and 2022 local results, 2026 House by district | Real, via the Atlas. 2022 mayor results hold the top two candidates only. |
| 2022 ward results | Real, via Kantipur. Benighat Rorang missing. |
| Final voter roll 2083 | Real. Local-level join by size, see 5.7. |
| 2026 House official totals | Real |
| Turnout history 1991 to 2022 | Real, from news reports. Two sources for 2022 disagree on other figures. |
| 2022 local turnout | Calculated, valid votes only |
| Visit status on first opening | Demo placeholder: each ward starts with a made-up share of buildings marked visited. Anything you change is saved. |
| Login, OTP, one-device rule | Mockup only |
| Tole filter | Disabled, no tole boundaries |
| Ward-level voter counts and ward turnout | Not published, so not shown |
| Past House elections by district before 2026 | Not included |

Other known limits:
- Census counts usual residents only, so voters per 100 adults can pass 100 (voters living abroad).
- Constituencies do not follow local-level boundaries, so 2026 House results stop at district level.
- The 22 parks, reserves and Kalapani have no election data.
- Registered voters for the March 2026 election are national only; the per-district roll behind it is not on the commission's site in a usable form.

## 7. Rebuilding the data

Needs Python 3 with `numpy` and `shapely`, plus `pdfplumber` for the roll. Edit the source paths at the top of each script.

```
py tools/build_boundaries.py                  # boundaries, Census, health POIs   (several minutes)
py tools/build_buildings.py                   # building footprints               (several minutes, 5.8 GB file)
py tools/add_counts.py                        # per-ward counts into hier.json
py tools/build_elections.py <atlas.html>      # data/elections.json
py tools/scrape_ekantipur.py                  # run inside a folder, writes out/    (about 20 min)
py tools/build_results22.py <out folder>      # data/results22.json
py tools/build_roll83.py <roll.pdf>           # data/roll83.json
```

Order matters: boundaries first, then buildings, then counts. Re-run `add_counts.py` after any rebuild of the first two.

### Updating when new data arrives
- **New voter roll:** replace the PDF and run `build_roll83.py`. The notice list is at `election.gov.np/admin/public/api/resources/notice?lang=np&page=1` (follow redirects), and its `value` field holds the file URL.
- **Real results for other years:** extend `data/elections.json` or add a CSV loader; the Results tab reads from there.
- **New building layer:** put it in the same format and re-run `build_buildings.py`.

## 8. File map

```
index.html            page: login, filter bar, map, panel, modals
css/styles.css        styles and themes
js/app.js             all behaviour
data/hier.json        every unit: names, codes, boxes, Census counts, building and health counts
data/bounds.json      province and district outlines
data/dist/<code>.json municipality outlines
data/mun/<id>.json    ward polygons and health POIs
data/bld/<ward>.json  building footprints (421 MB, 6,771 files)
data/elections.json   2017, 2022 and 2026 results, 2022 voters, Census reach (753 local levels)
data/results22.json   2022 ward-level results (752 local levels)
data/roll83.json      final voter roll 2083 (province, district, local level)
sources/              the roll PDF and the House count press release
tools/                rebuild scripts
_backup_v11/          the earlier build 11 page, kept for reference
serve.py, start.bat   local no-cache server
manifest.json, icons/ home-screen install on phones
README.md             build-by-build change notes
```

## 9. Privacy and fair use

- No owner names, phone numbers or household identities are collected or shown. Field answers are counts and choices.
- Everything the user records stays in their own browser. Nothing is sent anywhere.
- The Kantipur scraper reads public pages, respects robots.txt, and runs slowly with three workers.
- The Election Commission files are public notices and press releases.
- A real roll of voters by name, if ever added, would need a separate decision about consent and law. The dashboard does not hold one.

## 10. Testing done

Checked in a browser during the build, with the console clear of errors each time:
- Page loads, province to ward drill-down, map layers, and buildings clickable on the shared canvas.
- Sidebar scrolls on desktop and phone width; phone layout and bottom sheet.
- Buildings of neighbouring municipalities load on zoom at municipality level (13 wards, about 78,000 buildings in one test).
- POI panel at ward, municipality and province level (2,771 health places for Koshi).
- 2083 roll at national, district, municipality and ward level; Kathmandu district total 714,193 matches the PDF.
- Two buildings answered with field questions: saved, totalled in the Visits tab, correct export columns.
- 2022 turnout 65.1% nationally and 53.2% for Kathmandu.

Not tested: real phones and slow connections, very large exports, long routes in dense wards, and use on a public domain (road tile access).

## 11. Open items and next steps

1. Replace the demo visit status with real data: either start every ward at zero, or add a shared store so several canvassers see each other's work.
2. Real login: mobile OTP and one device per user need a backend.
3. Official local-level turnout and the 2022 voter counts per local level, if the commission or a district office can supply them.
4. Earlier House elections by district, and ward-level 2017 results.
5. Tole boundaries, and the other place categories as Galli Maps adds them.
6. A shared place for field answers so a campaign can add up several people's work.
