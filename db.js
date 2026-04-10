// db.js
const Database = require('better-sqlite3');
const path = require('path');

// Connect to the GPKG file
const db = new Database(path.join(__dirname, 'data/afghanistan_data.gpkg'), {
    readonly: true,
    fileMustExist: true
});

// connect to analytics db
const analyticsDb = new Database(path.join(__dirname, 'data/analytics.db'), {
    readonly: false,
    fileMustExist: false
});

// Helper function to open MBTiles files if they exist, otherwise return null
function openOptional(filePath, readonly=true) {
    try {
        return new Database(filePath, { readonly: readonly, fileMustExist: true });
    } catch (e) {
        console.warn(`MBTiles not found, skipping: ${filePath}`);
        return null;
    }
}

// Open MBTiles files if they exist, otherwise set to null
const mbtilesDb =
{
    flood:      openOptional(path.join(__dirname, 'data/flood_rp20.mbtiles')),
    landslide:  openOptional(path.join(__dirname, 'data/landslide_rp20.mbtiles')),
    avalanche:  openOptional(path.join(__dirname, 'data/avalanche_rp100.mbtiles')),
    earthquake: openOptional(path.join(__dirname, 'data/earthquake_rp475.mbtiles')),
    contours :  openOptional(path.join(__dirname, 'data/contours_100m.mbtiles')),
    roads:      openOptional(path.join(__dirname, 'data/main_afg_roads.mbtiles')) // open roads with write access for caching
};

module.exports = { db, mbtilesDb, analyticsDb }; 