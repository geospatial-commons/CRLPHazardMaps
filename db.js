// db.js
const Database = require('better-sqlite3');
const path = require('path');
 
// Connect to the GPKG file
const db = new Database(path.join(__dirname, 'data/afghanistan_data.gpkg'), {
    readonly: true,
    fileMustExist: true
});
 
// const mbtilesDb = new Database(path.join(__dirname, 'data/landcover.mbtiles'), { readonly: false });
 
// mbtilesDb.pragma('journal_mode = WAL'); //his enables "Write-Ahead Logging," which makes concurrent reads much faster.
 
module.exports = db; 