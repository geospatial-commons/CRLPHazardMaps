const express = require('express');
const path = require('path');
const { db, mbtilesDb, analyticsDb, customCommunitiesDb } = require('../db');
const router = express.Router();
const wellknown = require('wellknown');
const { validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');

const EMPTY_TILE_BUFFER = Buffer.from([
    0x1f, 0x8b, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x03, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00
]);

// Import your custom validators
const validationParam = require('./validationParams.js');

// Landing page route
router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'views', 'landing.html'));
});

// App route
router.get('/app', (req, res) => {
    // console.log(req.cookies);
    var decodedToken = jwt.decode(req.cookies.userToken, { complete: true });

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

router.get('/tiles/contours/:z/:x/:y.pbf', validationParam.validateVectorTiles, (req, res) => {
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
        res.setHeader('Cache-Control', 'public, max-age=1209600'); // Cache for 2 weeks


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
            SELECT fid,
                   point_name, 
                   norm_dist_code,
                   norm_dist_name,
                   coord_y,
                   coord_x,
                   match_cdc_id,
                   match_cdc_name,
                   Arazi_OBJ_ID,
                   UNOPS_Code,
                   IOM_Code,
                   GPS_Verified
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
                properties: {
                    fid: c.fid,
                    name: c.point_name,
                    norm_dist_code: c.norm_dist_code,
                    norm_dist_name: c.norm_dist_name,
                    match_cdc_id: c.match_cdc_id,
                    match_cdc_name: c.match_cdc_name,
                    Arazi_OBJ_ID: c.Arazi_OBJ_ID,
                    UNOPS_Code: c.UNOPS_Code,
                    IOM_Code: c.IOM_Code,
                    coord_x: c.coord_x,
                    coord_y: c.coord_y,
                    gps_verified: c.GPS_Verified
                },
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
                COALESCE(match_cdc_name, point_name) AS display_name, 
                -- If display_name took cdc_name, secondary shows point_name and vice versa
                CASE 
                    WHEN match_cdc_name IS NOT NULL THEN point_name 
                    ELSE '' 
                END AS secondary_name,
                match_cdc_id,
                norm_prov_code,
                norm_dist_code,
                coord_x, 
                coord_y
            FROM settlements
            WHERE match_cdc_name LIKE ? OR point_name LIKE ?
            ORDER BY 
                (match_cdc_name LIKE ?) DESC, -- Exact/Prefix CDC matches first
                display_name ASC             -- Then alphabetical
            LIMIT 50
        `;

        const searchTerm = `%${q}%`;
        // We pass searchTerm three times: for match_cdc_name, point_name, and the ORDER BY
        const results = db.prepare(query).all(searchTerm, searchTerm, searchTerm);
        res.json(results);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Name search failed" });
    }
});

// Search By UNOPS Code (Matches any part of the code, prioritizes starts-with)
router.get('/api/communities/search/code', validationParam.validateSearchCode, (req, res) => {
    const { q } = req.query;

    try {
        const query = `
            SELECT 
                COALESCE(match_cdc_name, point_name) AS display_name, 
                -- Provides the point_name as secondary info if it's different from display_name
                CASE 
                    WHEN match_cdc_name IS NOT NULL THEN point_name 
                    ELSE '' 
                END AS secondary_name,
                match_cdc_id,
                norm_prov_code,
                norm_dist_code, 
                coord_x, 
                coord_y
            FROM settlements
            WHERE match_cdc_id LIKE ?             -- 1st parameter: %q% (contains)
            ORDER BY 
                CASE 
                    WHEN match_cdc_id LIKE ? THEN 1 -- 2nd parameter: q% (starts-with)
                    ELSE 2 
                END, 
                match_cdc_id ASC
            LIMIT 50
        `;

        // We bind the "contains" version to the WHERE and the "starts-with" to the ORDER BY
        const results = db.prepare(query).all(`%${q}%`, `${q}%`);

        res.json(results);
    } catch (err) {
        console.error("Code search error:", err);
        res.status(500).json({ error: "Code search failed" });
    }
});

// API route to log map creation analytics
router.post('/api/analytics/map-creation', (req, res) => {

    try {
        const {
            hazard = null,
            Pcode = null,
            province_code = null,
            community_name = null,
            arazi_code = null,
            UNOPS_Code = null,
            IOM_Code = null,
            request_type
        } = req.body;

        const stmt = analyticsDb.prepare(`
            INSERT INTO map_creation_analytics (
                hazard,
                Pcode,
                province_code,
                community_name,
                arazi_code,
                UNOPS_Code,
                IOM_Code,
                request_type
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const result = stmt.run(
            hazard,
            Pcode,
            province_code,
            community_name,
            arazi_code,
            UNOPS_Code,
            IOM_Code,
            request_type
        );

        console.log("Analytics logged with ID:", result.lastInsertRowid);
        res.status(201).json({
            success: true,
            id: result.lastInsertRowid
        });
    } catch (err) {
        console.error('Analytics insert error:', err);
        res.status(500).json({ error: 'Failed to save analytics' });
    }
});

router.get('/tiles/roads/:z/:x/:y.pbf', validationParam.validateVectorTiles, (req, res) => {
    if (!Object.hasOwn(mbtilesDb, 'roads') || !mbtilesDb['roads']) {
        return res.status(404).end();
    }

    const z = Number(req.params.z);
    const x = Number(req.params.x);
    const y = Number(req.params.y);
    const flippedY = (1 << z) - 1 - y;

    try {
        const stmt = mbtilesDb['roads'].prepare(`
            SELECT tile_data FROM tiles
            WHERE zoom_level = ?
            AND tile_column = ?
            AND tile_row = ?
        `);

        const tile = stmt.get(z, x, flippedY);


        res.setHeader('Content-Type', 'application/x-protobuf');
        res.setHeader('Content-Encoding', 'gzip');
        res.setHeader('Cache-Control', 'public, max-age=1209600'); // Cache for 2 weeks

        if (!tile) {
            return res.send(EMPTY_TILE_BUFFER).end();
        }

        res.send(tile.tile_data);

    } catch (err) {
        console.error(err);
        res.status(500).send("Tile error");
    }
});

// Authentication routes (simplified for demonstration)
router.post('/login', validationParam.validateLogin, (req, res) => {

    try {
        //check master password first this will be changed in the future to a more robust authentication system but for now this is sufficient for the use case of custom communities management
        if (req.body.password != process.env.MASTER_PASSWORD) {
            return res.status(403).send('Invalid password');
        }

        // Check if user exists in the database
        const query = `
            SELECT user, role
            FROM users
            WHERE user = ?
        `;
        const user = customCommunitiesDb.prepare(query).all([req.body.email])

        // If user exists, create and send JWT token
        if (user.length > 0) {

            //process jsonwebtoken
            const SECRET_KEY = process.env.SECRET_KEY;
            const payload = {
                'email': user[0].user,
                'role': user[0].role
            }

            const token = jwt.sign(payload, SECRET_KEY, {
                algorithm: 'HS256',
                expiresIn: '30d' // Keep it matched with your 30-day cookie
            });

            res.cookie("userToken", token, {
                httpOnly: true,
                SameSite: 'Strict',
                //secure: true, // Uncomment if using HTTPS
                maxAge: 2592000000,
                //signed: true 
            })

            return res.status(200).send('User found');
        } else {
            return res.status(403).send('User not found');
        }
    } catch (err) {
        console.log(err)
        return res.status(500).send('Something went wrong on the server');
    }
})

// Logout route - clears the token cookie and realoads the current page to update the UI accordingly
router.get('/logout', (req, res) => {
    res.clearCookie("userToken");
    res.status(200).send('Logged out');
});

// Get user info route - verifies the JWT token and returns user details
router.get('/api/user', (req, res) => {
    try {
        const token = req.cookies.userToken;
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }
        const decoded = jwt.verify(token, process.env.SECRET_KEY);
        res.json({ email: decoded.email, role: decoded.role });
    } catch (err) {
        console.error('Token verification error:', err);
        res.status(401).json({ error: 'Invalid token' });
    }
});

module.exports = router;