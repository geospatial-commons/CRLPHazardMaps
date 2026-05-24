const express = require('express');
const router = express.Router();
const wellknown = require('wellknown');
const { customCommunitiesDb } = require('../db');

const turf = require('@turf/turf')
const provinces = require('../data/provinces.json')
const districts = require('../data/districts.json')


router.post('/api/custom-communities', (req, res) => {
    let { lat, lon, name } = req.body;
    let admin1_pcode = '';

    const point = turf.point([lon, lat]);

    for (const feature of provinces.features) {
        if (turf.booleanPointInPolygon(point, feature)) {
            admin1_pcode = feature.properties.Prov_name;
        }
    }

    for (const feature of districts.features) {
        if (turf.booleanPointInPolygon(point, feature)) {
            admin2_pcode = feature.properties.Dist_name;
        }
    }


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
            existing_community_id,
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
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, '', name, lat, lon, '', admin1_pcode, admin2_pcode, '', now, 'New', 'CRLP App');

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
        SELECT rowid,
                community_id, 
                existing_community_id, 
                point_name, 
                coord_y AS lat, 
                coord_x AS lon,
                admin1_pcode,
                admin2_pcode
        FROM crlp_custom_communities t1
        WHERE status <> 'Deleted'
            and t1.modified_dt = (
                SELECT MAX(modified_dt)
                FROM crlp_custom_communities t2
                WHERE t2.community_id = t1.community_id
            )
    `).all();


        const geojson = {
            type: "FeatureCollection",
            features: communities.map(c => ({
                type: "Feature",
                geometry: wellknown.parse(`POINT(${c.lon} ${c.lat})`),
                properties: {
                    rowid : c.rowid,
                    community_id: c.community_id,
                    existing_community_id: c.existing_community_id,
                    name: c.point_name,
                    prov : c.admin1_pcode,
                    dist : c.admin2_pcode

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
    const { community_id } = req.body;

    const now = new Date().toISOString();

    try {
        customCommunitiesDb.prepare(`
            INSERT INTO crlp_custom_communities (
                community_id,
                existing_community_id,
                point_name,
                coord_y,
                coord_x,
                pcode,
                admin1_pcode,
                admin2_pcode,
                editor,
                modified_dt,
                status,
                data_source
            )
            SELECT
                community_id,
                existing_community_id,
                point_name,
                coord_y,
                coord_x,
                pcode,
                admin1_pcode,
                admin2_pcode,
                editor,
                ?,
                'Deleted',
                data_source
            FROM crlp_custom_communities
            WHERE community_id = ?
            ORDER BY modified_dt DESC
            LIMIT 1
        `).run(now, community_id);

        res.json({ message: 'Community deleted successfully' });
    } catch (err) {
        console.error('Error deleting community:', err);
        res.status(500).json({ error: 'Failed to delete community' });
    }
});

router.post('/api/custom-communities/update', (req, res) => {
    let { community_id, existing_community_id, lat, lon, name } = req.body;

    if (!community_id && !existing_community_id) {
        return res.status(400).json({ error: 'Missing community_id' });
    }

    if (!community_id) {
        community_id = crypto.randomUUID();
    }

    const point = turf.point([lon, lat]);

    for (const feature of provinces.features) {
        if (turf.booleanPointInPolygon(point, feature)) {
            admin1_pcode = feature.properties.Prov_name;
        }
    }

    for (const feature of districts.features) {
        if (turf.booleanPointInPolygon(point, feature)) {
            admin2_pcode = feature.properties.Dist_name;
        }
    }

    const now = new Date().toISOString();

    try {
        customCommunitiesDb.prepare(`
            INSERT INTO crlp_custom_communities (
                community_id,
                existing_community_id,
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
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(community_id, existing_community_id, name, lat, lon, '', admin1_pcode, admin2_pcode, '', now, 'Modified', 'CRLP App');

        res.json({ message: 'Updated via versioning' });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update' });
    }
});


module.exports = router;
