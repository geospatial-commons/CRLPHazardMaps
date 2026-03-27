const express = require('express');
const path = require('path');
const { db, mbtilesDb } = require('../db');
const router = express.Router();
const wellknown = require('wellknown');

// Import your custom validators
const validationParam = require('./validationParams.js'); // Adjust path as necessary

// Landing page route
router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'views', 'landing.html'));
});

// App route
router.get('/app', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'views', 'index.html'));
});

router.get('/tiles/:layer/:z/:x/:y.png', validationParam.validateTiles, (req, res) => {

    const { layer, z, x, y: yParam } = req.params;

    if (!Object.hasOwn(mbtilesDb, layer) || !mbtilesDb[layer]) {
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

router.get('/tiles/contours/:z/:x/:y.pbf', validationParam.validateContours, (req, res) => {
    if (!Object.hasOwn(mbtilesDb, 'contours') || !mbtilesDb['contours']) {
        return res.status(404).end();
    }

    const { z, x, y: yParam } = req.params;
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
router.get('/api/provinces/:quality', validationParam.validateProvinces, (req, res) => {
    const { quality } = req.params;

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

router.get('/api/districts/:provId', validationParam.validateDistricts, (req, res) => {
    const { provId } = req.params;
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
router.get('/api/communities/:distId', validationParam.validateCommunities, (req, res) => {
    const { distId } = req.params;

    try {
        // SQL Query: Fetch only communities matching the district ID
        // Note: Replace 'communities_table' with the actual table name in your GPKG
        const query = `
            SELECT point_name, norm_dist_code,
                   coord_y,
                   coord_x,
                   match_cdc_id,
                   match_cdc_name
            FROM settlements
            WHERE norm_dist_code = ? 
            /*and GPS_Verified = true*/
            /*and match_cdc_id IS NOT NULL*/
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

router.get('/api/district-capitals', (req, res) => {
    try {
        const query = `
            SELECT dis_name, POINT_X, POINT_Y
            FROM AfghanistanAdminCenters
            WHERE Unit_Type = 'District_Center'
        `;

        const districtCapitals = db.prepare(query).all();

        const geojson = {
            type: "FeatureCollection",
            features: districtCapitals.map(c => ({
                type: "Feature",
                properties: { name: c.dis_name },
                geometry: {
                    type: "Point",
                    coordinates: [c.POINT_X, c.POINT_Y]
                }
            }))
        };

        res.json(geojson);
    } catch (err) {
        console.error(err);
        res.status(500).send("Database Error");
    }
});

// Search by Name (Partial match anywhere)
router.get('/api/communities/search/name', validationParam.validateSearchName, (req, res) => {
    const { q } = req.query;

    try {
        const query = `
            SELECT 
                point_name AS display_name, 
                match_cdc_id,
                norm_dist_code,
                norm_prov_code,
                coord_x, 
                coord_y
            FROM settlements
            WHERE point_name LIKE ?
            ORDER BY (point_name LIKE ?) DESC -- Prioritizes matches in point_name first
            LIMIT 50
        `;

        const searchTerm = `%${q}%`;
        // We pass searchTerm three times: for match_cdc_name, point_name, and the ORDER BY
        const results = db.prepare(query).all(searchTerm, searchTerm);
        res.json(results);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Name search failed" });
    }
});

//Search By UNOPS Code (Exact match anywhere in the code)
router.get('/api/communities/search/code', validationParam.validateSearchCode, (req, res) => {
    const { q } = req.query;

    try {
        const query = `
            SELECT 
                point_name AS display_name, 
                match_cdc_id,
                norm_prov_code,
                norm_dist_code, 
                coord_x, 
                coord_y
            FROM settlements
            WHERE match_cdc_id LIKE ?             -- 1st parameter: %q%
            ORDER BY 
                CASE 
                    WHEN match_cdc_id LIKE ? THEN 1 -- 2nd parameter: q%
                    ELSE 2 
                END, 
                match_cdc_id ASC
            LIMIT 50
        `;

        // Pass them as individual arguments (or use the array spread operator)
        const results = db.prepare(query).all(`%${q}%`, `${q}%`);
        res.json(results);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Code search failed" });
    }
});


module.exports = router;