const express = require('express');
const path = require('path');
const { db, mbtilesDb } = require('../db');
const router = express.Router();
const wellknown = require('wellknown');

// Landing page route
router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'views', 'landing.html'));
});

// App route
router.get('/app', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'views', 'index.html'));
});

router.get('/tiles/:layer/:z/:x/:y.png', (req, res) => {

    const { layer } = req.params;
    const z = parseInt(req.params.z);
    const x = parseInt(req.params.x);

    if (!mbtilesDb[layer]) {
        return res.status(404).send("Layer not found");
    }
    // Flip Y (TMS → XYZ)
    const y = Math.pow(2, z) - 1 - parseInt(req.params.y);

    try {
        const stmt = mbtilesDb[layer].prepare(`
            SELECT tile_data FROM tiles
            WHERE zoom_level = ?
            AND tile_column = ?
            AND tile_row = ?
        `);

        const tile = stmt.get(z, x, y);

        if (tile) {
            res.setHeader('Content-Type', 'image/png');
            res.send(tile.tile_data);
        } else {
            res.sendFile(path.join(__dirname, '..', 'public', 'assets', 'img', 'transparent256.png'));
            return;
            // res.status(404).send("Tile not found");
        }

    } catch (err) {
        console.error(err);
        res.status(500).send("Tile error");
    }
});

router.get('/tiles/contours/:z/:x/:y.pbf', (req, res) => {
    if (!mbtilesDb['contours']) return res.status(404).end();

    const z = parseInt(req.params.z);
    const x = parseInt(req.params.x);
    const y = Math.pow(2, z) - 1 - parseInt(req.params.y);

    try {
        const stmt = mbtilesDb['contours'].prepare(`
            SELECT tile_data FROM tiles
            WHERE zoom_level = ?
            AND tile_column = ?
            AND tile_row = ?
        `);

        const tile = stmt.get(z, x, y);
        if (!tile) {
            return res.status(204).end();
        }

        res.setHeader('Content-Type', 'application/x-protobuf');
        res.setHeader('Content-Encoding', 'gzip');


        res.send(tile.tile_data);

    } catch (err) {
        console.error(err);
        res.status(500).send("Tile error");
    }
});

// API route to fetch all provinces
router.get('/api/provinces/:quality', (req, res) => {
    const quality = req.params.quality; // 'simplified' or 'detailed'

    try {
        let query = '';
        if (quality == 0) {
            query = `
            SELECT Prov_name, Pro_ID, geom_to_wkt
            FROM simplified
        `;
        } else {
            query = `
            SELECT Prov_name, Pro_ID, geom_to_wkt
            FROM provinces
        `;
        }

        const provinces = db.prepare(query).all();

        const geojson = {
            type: "FeatureCollection",
            features: provinces.map(p => ({
                type: "Feature",
                properties: {
                    name: p.Prov_name,
                    provID: p.Pro_ID
                },
                geometry: wellknown.parse(p.geom_to_wkt)
            }))
        };

        res.json(geojson);
    } catch (err) {
        console.error(err);
        res.status(500).send("Database Error");
    }
});

router.get('/api/districts/:provId', (req, res) => {
    const provId = req.params.provId;
    try {
        // SQL Query: Fetch only districts matching the province ID
        // Note: Replace 'districts_table' with the actual table name in your GPKG
        const query = `
            SELECT Dist_name, Pro_ID, Dist_ID_24, geom_to_wkt
            from districts
            where Pro_Id = ?
        `;

        const districts = db.prepare(query).all(provId);

        // Convert the SQL results into a tiny GeoJSON-like format for Leaflet
        const geojson = {
            type: "FeatureCollection",
            features: districts.map(d => ({
                type: "Feature",
                properties: {
                    name: d.Dist_name,
                    provID: d.Pro_ID,
                    distID: d.Dist_ID_24
                },
                geometry: wellknown.parse(d.geom_to_wkt)
            }))
        };

        res.json(geojson);
    } catch (err) {
        console.error(err);
        res.status(500).send("Database Error");
    }
});

// API route to fetch filtered communities via SQL
router.get('/api/communities/:distId', (req, res) => {
    const distId = req.params.distId;

    try {
        // SQL Query: Fetch only communities matching the district ID
        // Note: Replace 'communities_table' with the actual table name in your GPKG
        const query = `
            SELECT point_name, norm_dist_code,
                   coord_y,
                   coord_x
            FROM settlements
            WHERE norm_dist_code = ? 
            /*and GPS_Verified = true*/
        `;

        const communities = db.prepare(query).all(distId);

        // Convert the SQL results into a tiny GeoJSON-like format for Leaflet
        const geojson = {
            type: "FeatureCollection",
            features: communities.map(c => ({
                type: "Feature",
                properties: { name: c.point_name, norm_dist_code: c.norm_dist_code },
                geometry: {
                    type: "Point",
                    coordinates: [c.coord_x, c.coord_y]
                }
            }))
        };

        res.json(geojson);
    } catch (err) {
        console.error(err);
        res.status(500).send("Database Error");
    }
});

module.exports = router;