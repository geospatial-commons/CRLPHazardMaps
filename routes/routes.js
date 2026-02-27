const express = require('express');
const path = require('path');
const db = require('../db');
const router = express.Router();

// Landing page route
router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'views', 'landing.html'));
});

// App route
router.get('/app', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'views', 'index.html'));
});

// 2. New API route to fetch filtered settlements via SQL
router.get('/api/settlements/:distId', (req, res) => {
    const distId = req.params.distId;
 
    try {
        // SQL Query: Fetch only settlements matching the district ID
        // Note: Replace 'settlements_table' with the actual table name in your GPKG
        const query = `
            SELECT point_name, norm_dist_code,
                   coord_y,
                   coord_x
            FROM settlements
            WHERE norm_dist_code = ?
        `;
 
        const settlements = db.prepare(query).all(distId);
 
        // Convert the SQL results into a tiny GeoJSON-like format for Leaflet
        const geojson = {
            type: "FeatureCollection",
            features: settlements.map(s => ({
                type: "Feature",
                properties: { name: s.point_name, norm_dist_code: s.norm_dist_code },
                geometry: {
                    type: "Point",
                    coordinates: [s.coord_x, s.coord_y]
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