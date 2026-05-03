const express = require('express');
const router = express.Router();
const wellknown = require('wellknown');
const { customCommunitiesDb } = require('../db');

router.post('/api/custom-communities', (req, res) => {
    let { lat, lon, name } = req.body;

    if (
        typeof lat !== 'number' ||
        typeof lon !== 'number' ||
        typeof name !== 'string'
    ) {
        return res.status(400).json({ error: 'Invalid input data' });
    }
    if (name.trim() === '') {
        name = 'Unnamed';
    }
    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    console.log('Received new community:', { name, lat, lon });

    const result = customCommunitiesDb.prepare(`
        INSERT INTO crlp_custom_communities (
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
    `).run(id, name, lat, lon, '', '', '', '', now, 'New', 'CRLP App');

    res.status(201).json({
        id,
        name,
        lat,
        lon
    });

});

router.get('/api/custom-communities', (req, res) => {
    try {
        const communities = customCommunitiesDb.prepare(`
        SELECT community_id, point_name, coord_y AS lat, coord_x AS lon
        FROM crlp_custom_communities
        WHERE status <> 'Deleted' 
            and editor = ''
    `).all();

        const geojson = {
            type: "FeatureCollection",
            features: communities.map(c => ({
                type: "Feature",
                geometry: wellknown.parse(`POINT(${c.lon} ${c.lat})`),
                properties: {
                    community_id: c.community_id,
                    name: c.point_name
                }
            }))
        };

        res.json(geojson);
    } catch (err) {
        console.error('Error fetching communities:', err);
        res.status(500).json({ error: 'Failed to fetch communities' });
    }
});

router.delete('/api/custom-communities', (req, res) => {
    const id = req.body.id;

    try {
        customCommunitiesDb.prepare(`
            UPDATE crlp_custom_communities
            SET status = 'Deleted'
            WHERE id = ?
        `).run(id);
        res.json({ message: 'Community deleted successfully' });
    } catch (err) {
        console.error('Error deleting community:', err);
        res.status(500).json({ error: 'Failed to delete community' });
    }
});

router.post('/api/custom-communities/update', (req, res) => {
    const { community_id, lat, lon, name } = req.body;

    if (!community_id) {
        return res.status(400).json({ error: 'Missing community_id' });
    }

    const now = new Date().toISOString();

    try {
        // 1. Mark old versions as deleted
        customCommunitiesDb.prepare(`
            UPDATE crlp_custom_communities
            SET status = 'Deleted'
            WHERE community_id = ?
        `).run(community_id);

        // 2. Insert new version
        customCommunitiesDb.prepare(`
            INSERT INTO crlp_custom_communities (
                community_id,
                point_name,
                coord_y,
                coord_x,
                modified_dt,
                status,
                data_source
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
            community_id,
            name,
            lat,
            lon,
            now,
            'Modified',
            'CRLP App'
        );

        res.json({ message: 'Updated via versioning' });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update' });
    }
});


module.exports = router;
