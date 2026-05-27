const express = require('express');
const router = express.Router();
const wellknown = require('wellknown');
const { customCommunitiesDb } = require('../db');

const turf = require('@turf/turf')
const provinces = require('../data/provinces.json')
const districts = require('../data/districts.json')

// Import your custom validators
const validationParam = require('./validationParams.js');

//Import authentication middleware
const jwt = require('jsonwebtoken');

const requireAuth = (req, res, next) => {
    try {
        // 1. Extract the token from cookies
        const token = req.cookies.userToken;

        // 2. If no token exists, block access immediately
        if (!token) {
            return res.status(401).json({ error: 'Access denied. Please log in.' });
        }

        // 3. Verify the token with your environment secret key
        const decoded = jwt.verify(token, process.env.SECRET_KEY);

        // 4. Attach decoded payload (e.g., email, role) to the request object
        req.user = decoded;

        // 5. Pass control to your route handler or next middleware
        next(); 
    } catch (err) {
        console.error('Authentication error:', err.message);
        // Clean up the invalid cookie if verification fails
        res.clearCookie('userToken');
        return res.status(401).json({ error: 'Session expired or invalid. Please log in again.' });
    }
};

// Get all custom communities
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

// Create a new custom community with versioning (status 'New')
router.post('/api/custom-communities', requireAuth, validationParam.validateCreateCommunity, (req, res) => {
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

// Delete a custom community (soft delete by marking status as 'Deleted')
router.delete('/api/custom-communities', requireAuth, validationParam.validateDeleteCommunity, (req, res) => {
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

// Update a custom community (versioning by inserting a new record with status 'Modified')
router.post('/api/custom-communities/update', requireAuth, validationParam.validateUpdateCommunity,  (req, res) => {
    let admin1_pcode
    let admin2_pcode

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
