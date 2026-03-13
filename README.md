# CRLP Automated Mapping Web Solution

A semi-automated web application for generating hazard risk maps for community-level disaster resilience planning in Afghanistan. Developed for the World Bank's **Community Resilience and Livelihoods Program (CRLP)** in partnership with **UNOPS**.

**Purpose:** Enable field teams to quickly produce professional, print-ready hazard maps for use in community consultations with disaster risk management groups.

---

## Key Features

- Web-based interface for on-demand map generation
- Multi-hazard layer support: earthquake, flood, landslide, avalanche, heat stress
- Drill-down location selection: Province -> District -> Community
- Automated legend and scale generation
- PDF export optimized for print
- Integration with Fathom flood data, GEM earthquake data, ESA land cover, and other hazard datasets
- Tile serving from local MBTiles files, no external tile service required

---

## Tech Stack

| Layer | Technology |
|---|---|
| Server | Node.js + Express 5 |
| Database | better-sqlite3 (GeoPackage + MBTiles) |
| Map client | Leaflet 1.9 |
| PDF export | jsPDF + html-to-image |
| Geometry | WellKnown (WKT → GeoJSON) |

---

## Prerequisites

### 1. Node.js (LTS)

Download and install from [nodejs.org](https://nodejs.org/). The LTS version is recommended.

Verify installation:

```bash
node -v
npm -v
```

### 2. C++ Build Tools (required for `better-sqlite3`)

The `better-sqlite3` package is a native Node addon that must be compiled during `npm install`. You need a C++ toolchain:

**Windows:**

Install [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) and select the **"Desktop development with C++"** workload. Python is also required (node-gyp uses it).

The quickest option is to run this once in an elevated terminal:

```bash
npm install --global windows-build-tools
```

**macOS:**

```bash
xcode-select --install
```

**Linux:**

```bash
sudo apt-get install build-essential python3
```

---

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/mena-gis/CRLPHazardMaps.git
cd CRLPHazardMaps
```

### 2. Install Dependencies

```bash
npm install
```

This compiles the native `better-sqlite3` addon and installs all packages listed in `package.json`. If this step fails, see [Troubleshooting](#troubleshooting).

### 3. Add the Data Files

The spatial data files are not tracked in git and must be obtained separately. **Contact the project team for access**. Files are available on SharePoint at:

Go to, or create, the `data/` directory at the project root and place the following files inside it:

```
CRLPHazardMaps/
└── data/
    ├── afghanistan_data.gpkg
    ├── hzd-agf-fl_20rp-fathom.mbtiles
    ├── landslide.mbtiles
    ├── afg-ls_lav_100rp.mbtiles
    └── afg_eq-GEM.mbtiles
```

| File | Contents |
|---|---|
| `afghanistan_data.gpkg` | GeoPackage with province, district, and settlement boundaries |
| `hzd-agf-fl_20rp-fathom.mbtiles` | Flood hazard raster tiles (Fathom, 20-year return period) |
| `landslide.mbtiles` | Landslide hazard raster tiles |
| `afg-ls_lav_100rp.mbtiles` | Avalanche hazard raster tiles (100-year return period) |
| `afg_eq-GEM.mbtiles` | Earthquake hazard raster tiles (GEM/OpenQuake) |

> **Note:** The filenames must match exactly as listed above. The server will fail to start if any file is missing.

### 4. Start the Server

```bash
node server.js
```

You should see output confirming the server is running.

### 5. Open the Application

Navigate to [http://localhost:3000](http://localhost:3000) in your browser.

---

## Usage

1. **Landing page** — click **Enter Application** to open the map.
2. **Select a location** — use the dropdowns to filter by Province, District, and Community. The map zooms to your selection.
3. **Toggle a hazard layer** — use the radio buttons in the side panel to overlay flood, landslide, avalanche, or earthquake data.
4. **Export to PDF** — click the PDF export button to generate a print-ready map of the current view.

---

## Project Structure

```
CRLPHazardMaps/
├── server.js                   # Express server entry point
├── db.js                       # Database connections (GeoPackage + MBTiles)
├── routes/
│   └── routes.js               # API routes and tile-serving endpoints
├── views/
│   ├── landing.html            # Splash/landing page
│   └── index.html              # Main map application
├── public/
│   ├── hazard-config.json      # Hazard layer configuration (legends, colors, descriptions)
│   ├── js/map.js               # Client-side Leaflet map logic
│   └── css/                    # Stylesheets
└── data/                       # NOT in git — add manually (see above)
    ├── afghanistan_data.gpkg
    ├── hzd-agf-fl_20rp-fathom.mbtiles
    ├── landslide.mbtiles
    ├── afg-ls_lav_100rp.mbtiles
    └── afg_eq-GEM.mbtiles
```

---

## Configuration

### Port

The server defaults to port **3000**. To use a different port, set the `PORT` environment variable before starting:

```bash
PORT=8080 node server.js
```

On Windows:

```cmd
set PORT=8080 && node server.js
```

### Hazard Layers

Hazard layer metadata (legend labels, color scales, descriptions) is configured in [public/hazard-config.json](public/hazard-config.json). Edit this file to update legends or descriptions without changing application code.

---

## API Endpoints

The server exposes the following endpoints (used internally by the map client):

| Endpoint | Description |
|---|---|
| `GET /` | Landing page |
| `GET /app` | Main map application |
| `GET /tiles/:layer/:z/:x/:y.png` | Serves raster tiles from MBTiles |
| `GET /api/provinces/:quality` | Province boundaries as GeoJSON |
| `GET /api/districts/:provId` | District boundaries for a province |
| `GET /api/communities/:distId` | Settlement points for a district |

---

## Contributing

This repository is maintained by the Afghanistan DRM team at the World Bank (@rydela | @Tomread87 | @adm-gis). For issues or contributions, open a pull request or contact the team via the project SharePoint and email. 
