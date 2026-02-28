// db.js
const Database = require('better-sqlite3');
const path = require('path');

// Connect to the GPKG file
const db = new Database(path.join(__dirname, 'data/afghanistan_data.gpkg'), {
    readonly: true,
    fileMustExist: true
});

const mbtilesDb =
{
    flood: new Database(path.join(__dirname, 'data/landslide_v2.mbtiles'), { readonly: true }),
    landslide: new Database(path.join(__dirname, 'data/landslide_v2.mbtiles'), { readonly: true }),
};

//This enables "Write-Ahead Logging," which makes concurrent reads much faster.
Object.values(mbtilesDb).forEach(tileDb => tileDb.pragma('journal_mode = WAL')); 

module.exports = { db, mbtilesDb }; 