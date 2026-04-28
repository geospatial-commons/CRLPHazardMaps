const express = require('express');
const router = express.Router();
const { customSettlementsDb } = require('../db');

router.post('/create-settlements', (req, res) => {
    const { lat, lon, name } = req.body;

    if (
        typeof lat !== 'number' ||
        typeof lon !== 'number' ||
        typeof name !== 'string'
    ) {
        return res.status(400).json({ error: 'Invalid input data' });
    }

    const now = new Date().toISOString();
    const wkt = `POINT(${lon} ${lat})`;

    console.log('Received new settlement:', { name, lat, lon, wkt });

    const result = customSettlementsDb.prepare(`
        INSERT INTO user_def_settlements (point_name, wkt, created_at, updated_at)
        VALUES (?, ?, ?, ?)
    `).run(name, wkt, now, now);

    res.status(201).json({
        name,
        wkt: wkt,
        created_at: now,
        updated_at: now
    });

});

module.exports = router;