# India Through Time — Interactive Historical Atlas (starter project)

A browser-based educational atlas for exploring historical kingdoms, rulers, capitals and selected wars in India and the surrounding South Asian region.

## Run locally

1. Install Node.js (LTS).
2. Open a terminal in this folder.
3. Run:

   ```bash
   npm start
   # or: node server.js
   ```

4. Open the web app at `http://localhost:8081`.
5. Access the REST API at `http://localhost:8081/api`.

## REST API Reference

The project includes a built-in REST API backend powered by Node.js (`server.js`):

| Endpoint | Description | Query Parameters |
| :--- | :--- | :--- |
| `GET /api` | API documentation & endpoint index | — |
| `GET /api/health` | Health check & server uptime | — |
| `GET /api/stats` | High-level dataset stats & era counts | — |
| `GET /api/kingdoms` | List kingdoms (filtered by era, year, query) | `year`, `q` / `search`, `era`, `region` |
| `GET /api/kingdoms/:id` | Detailed kingdom info + linked wars & boundary | — |
| `GET /api/wars` | List historical wars and battles | `year`, `q` / `search`, `kingdom` |
| `GET /api/wars/:id` | Specific battle record | — |
| `GET /api/rulers` | List historical rulers | `q` / `search`, `kingdom` |
| `GET /api/boundaries` | GeoJSON FeatureCollection of kingdom extents | `year`, `id` / `kingdom` |

### API Examples

- Active kingdoms in 1600 CE: `http://localhost:8081/api/kingdoms?year=1600`
- Search kingdoms matching "mughal": `http://localhost:8081/api/kingdoms?q=mughal`
- Single kingdom with related wars: `http://localhost:8081/api/kingdoms/maurya`
- Wars in 1526 (Battle of Panipat): `http://localhost:8081/api/wars?year=1526`
- GeoJSON boundaries for active kingdoms in 1600: `http://localhost:8081/api/boundaries?year=1600`

This project loads Leaflet and OpenStreetMap tiles from the internet, so an internet connection is required.

## Included features

- Timeline slider from 500 BCE to 2000 CE.
- Kingdom/empire list filtered by selected year.
- Search by kingdom, region or ruler name.
- Toggle kingdom outlines, capitals and selected wars/battles.
- Click a kingdom or battle to open its information panel.
- JSON data files for kingdoms, rulers and wars.
- GeoJSON layer for sample kingdom extents.

## Important historical-data limitation

The included GeoJSON polygons are **schematic teaching illustrations**, not validated historical boundaries. They are deliberately labelled as approximate. Historical borders shifted by ruler, year, campaign, tributary relationship and source interpretation. Do not cite these polygons as authoritative boundaries.

The JSON content is a starter catalogue, not an exhaustive or fully sourced scholarly dataset. Some date ranges and capitals are broad approximations. Before academic/public release, verify each entity and record with scholarly sources and replace the schematic polygons with dated, source-attributed GIS reconstructions.

## How to add better historical boundaries

Replace `data/boundaries.geojson` with a GeoJSON FeatureCollection from a licensed historical GIS source such as Cliopatria/Seshat. Each feature must have a `properties.id` matching an `id` in `data/kingdoms.json`. Keep provenance fields such as `source`, `source_url`, `valid_from`, `valid_to`, `confidence`, and `notes`.

For accurate year-by-year borders, store multiple features per kingdom with distinct validity periods and update the frontend filter to select only features whose `valid_from <= selected year <= valid_to`.

## Data files

- `data/kingdoms.json`: polity metadata and approximate dates.
- `data/rulers.json`: starter ruler name index; add verified reign dates and citations.
- `data/wars.json`: selected wars/battles, approximate coordinates and explanatory notes.
- `data/boundaries.geojson`: schematic illustrative polygons.

## Attribution

- Map tiles: © OpenStreetMap contributors — https://www.openstreetmap.org/copyright
- Map library: Leaflet — https://leafletjs.com/
- Historical data must retain the license and attribution of the source from which it is obtained.
