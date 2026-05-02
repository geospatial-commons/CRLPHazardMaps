const express = require('express');
const router = express.Router();
const wellknown = require('wellknown');
const { customSettlementsDb } = require('../db');

router.post('/api/custom-settlements', (req, res) => {
    const { lat, lon, name } = req.body;

    if (
        typeof lat !== 'number' ||
        typeof lon !== 'number' ||
        typeof name !== 'string'
    ) {
        return res.status(400).json({ error: 'Invalid input data' });
    }

    const now = new Date().toISOString();
    // const wkt = `POINT(${lon} ${lat})`;

    console.log('Received new settlement:', { name, lat, lon });

    const result = customSettlementsDb.prepare(`
        INSERT INTO crlp_custom_settlements (
            community_id,
            point_name,
            coord_y,
            coord_x,
            pcode,
            admin1_pcode,
            admin2_pcode,
            editor,
            modified_dt,
            status,
            data_source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('', name, lat, lon, '', '', '', '', now, 'New', 'CRLP App');

    res.status(201).json({
        name,
        lat,
        lon
    });

});

router.get('/api/custom-settlements', (req, res) => {
    try {
        const settlements = customSettlementsDb.prepare(`
        SELECT point_name, coord_y AS lat, coord_x AS lon
        FROM crlp_custom_settlements
        WHERE status <> 'Deleted' 
            and editor = ''
    `).all();

        const geojson = {
            type: "FeatureCollection",
            features: settlements.map(s => ({
                type: "Feature",
                geometry: wellknown.parse(`POINT(${s.lon} ${s.lat})`),
                properties: {
                    name: s.point_name
                }
            }))
        };

        res.json(geojson);
    } catch (err) {
        console.error('Error fetching settlements:', err);
        res.status(500).json({ error: 'Failed to fetch settlements' });
    }
});

router.delete('/api/custom-settlements', (req, res) => {
    const id = req.body.id;

    try {
        customSettlementsDb.prepare(`
            UPDATE crlp_custom_settlements
            SET status = 'Deleted'
            WHERE id = ?
        `).run(id);
        res.json({ message: 'Settlement deleted successfully' });
    } catch (err) {
        console.error('Error deleting settlement:', err);
        res.status(500).json({ error: 'Failed to delete settlement' });
    }
});

module.exports = router;
