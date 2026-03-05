# CRLP Hazard Maps

This is a Node.js application. Follow the instructions below to set up and run the project locally.

## Prerequisites

Before you begin, make sure you have the following installed:

- **Node.js** (recommended LTS version)  
  Download from: https://nodejs.org/
- **npm** (comes bundled with Node.js)

Verify installation:

```
node -v
npm -v
```

## Getting Started

### 1. Clone the Repository

If you haven’t already cloned the repository:

```
git clone https://github.com/mena-gis/CRLPHazardMaps.git
cd CRLPHazardMaps
```

### 2. Install Dependencies

Install all required Node modules:

```
npm install
```
This will install all dependencies listed in `package.json`.

### 3. Replace the Data Files

Add the following files to the `public/data/` directory:
- `districts.geojson`

Add the following files to the `data/` directory:
- `afghanistan_data.gpkg`
- `landslide_v2.mbtiles`

The required data files are available on SharePoint at:
`~/Documents/Map Automator Development/CRLPHazardMaps Data`


### 4. Start the Application

Run the following command to start the server:

```
node server.js
```

### 5. Access the Application

Once the server is running, open your browser and navigate to:

```
http://localhost:3000
```
