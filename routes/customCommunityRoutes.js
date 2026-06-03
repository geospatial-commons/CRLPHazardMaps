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
                crlp_community_id, 
                pk_id, 
                point_name, 
                coord_y AS lat, 
                coord_x AS lon,
                prov_name,
                dist_name
        FROM crlp_custom_communities t1
        WHERE status <> 'Deleted'
            and t1.modified_dt = (
                SELECT MAX(modified_dt)
                FROM crlp_custom_communities t2
                WHERE t2.crlp_community_id = t1.crlp_community_id
            )
    `).all();


        const geojson = {
            type: "FeatureCollection",
            features: communities.map(c => ({
                type: "Feature",
                geometry: wellknown.parse(`POINT(${c.lon} ${c.lat})`),
                properties: {
                    rowid : c.rowid,
                    crlp_community_id: c.crlp_community_id,
                    pk_id: c.pk_id,
                    name: c.point_name,
                    prov : c.prov_name,
                    dist : c.dist_name

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
    let prov_name = '';


    const point = turf.point([lon, lat]);

    for (const feature of provinces.features) {
        if (turf.booleanPointInPolygon(point, feature)) {
            prov_name = feature.properties.Prov_name;
        }
    }

    for (const feature of districts.features) {
        if (turf.booleanPointInPolygon(point, feature)) {
            dist_name = feature.properties.Dist_name;
        }
    }

    const now = new Date().toISOString();
    const crlp_community_id = crypto.randomUUID();

    console.log('Received new community:', { name, lat, lon });

    const result = customCommunitiesDb.prepare(`
        INSERT INTO crlp_custom_communities (
            crlp_community_id,
            pk_id,
            point_name,
            coord_y,
            coord_x,
            prov_name,
            dist_name,
            editor,
            modified_dt,
            status,
            gps_verified,
            data_source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(crlp_community_id, '', name, lat, lon, prov_name, dist_name, req.user.email, now, 'New', 'false', 'CRLP App');

    res.status(201).json({
        crlp_community_id,
        name,
        lat,
        lon
    });

});

// Delete a custom community (soft delete by marking status as 'Deleted')
router.delete('/api/custom-communities', requireAuth, validationParam.validateDeleteCommunity, (req, res) => {
    const { crlp_community_id } = req.body;

    const now = new Date().toISOString();

    try {
        customCommunitiesDb.prepare(`
            INSERT INTO crlp_custom_communities (
                crlp_community_id,
                pk_id,
                point_name,
                coord_y,
                coord_x,
                prov_name,
                dist_name,
                editor,
                modified_dt,
                status,
                gps_verified,
                data_source
            )
            SELECT
                crlp_community_id,
                pk_id,
                point_name,
                coord_y,
                coord_x,
                prov_name,
                dist_name,
                ?,
                ?,
                'Deleted',
                gps_verified,
                data_source
            FROM crlp_custom_communities
            WHERE crlp_community_id = ?
            ORDER BY modified_dt DESC
            LIMIT 1
        `).run(req.user.email, now, crlp_community_id);

        res.json({ message: 'Community deleted successfully' });
    } catch (err) {
        console.error('Error deleting community:', err);
        res.status(500).json({ error: 'Failed to delete community' });
    }
});

// Update a custom community (versioning by inserting a new record with status 'Modified')
router.post('/api/custom-communities/update', requireAuth, validationParam.validateUpdateCommunity,  (req, res) => {
    let prov_name
    let dist_name

    let { crlp_community_id, pk_id, lat, lon, name } = req.body;

    if (!crlp_community_id && !pk_id) {
        return res.status(400).json({ error: 'Missing crlp_community_id' });
    }

    if (!crlp_community_id) {
        crlp_community_id = crypto.randomUUID();
    }

    const point = turf.point([lon, lat]);

    for (const feature of provinces.features) {
        if (turf.booleanPointInPolygon(point, feature)) {
            prov_name = feature.properties.Prov_name;
        }
    }

    for (const feature of districts.features) {
        if (turf.booleanPointInPolygon(point, feature)) {
            dist_name = feature.properties.Dist_name;
        }
    }

    const now = new Date().toISOString();

    try {
        customCommunitiesDb.prepare(`
            INSERT INTO crlp_custom_communities (
                crlp_community_id,
                pk_id,
                point_name,
                coord_y,
                coord_x,
                prov_name,
                dist_name,
                editor,
                modified_dt,
                status,
                gps_verified,
                data_source)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(crlp_community_id, pk_id, name, lat, lon, prov_name, dist_name, req.user.email , now, 'Modified', 'false', 'CRLP App');

        res.json({ message: 'Updated via versioning' });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update' });
    }
});


module.exports = router;
