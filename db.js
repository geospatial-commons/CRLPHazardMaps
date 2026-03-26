// db.js
const Database = require('better-sqlite3');
const path = require('path');

// Connect to the GPKG file
const db = new Database(path.join(__dirname, 'data/afghanistan_data.gpkg'), {
    readonly: true,
    fileMustExist: true
});

function openOptional(filePath) {
    try {
        return new Database(filePath, { readonly: true, fileMustExist: true });
    } catch (e) {
        console.warn(`MBTiles not found, skipping: ${filePath}`);
        return null;
    }
}

const mbtilesDb =
{
    flood:      new Database(path.join(__dirname, 'data/flood_rp20.mbtiles'), { readonly: true }),
    landslide:  new Database(path.join(__dirname, 'data/landslide_rp20.mbtiles'), { readonly: true }),
    avalanche:  new Database(path.join(__dirname, 'data/avalanche_rp100.mbtiles'), { readonly: true }),
    earthquake: new Database(path.join(__dirname, 'data/earthquake_rp475.mbtiles'), { readonly: true }),
    contours :  openOptional(path.join(__dirname, 'data/contours_100m.mbtiles'))
};

module.exports = { db, mbtilesDb }; 