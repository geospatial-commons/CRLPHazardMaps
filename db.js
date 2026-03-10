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
    flood:      new Database(path.join(__dirname, 'data/hzd-agf-fl_20rp-fathom.mbtiles'), { readonly: true }),
    landslide:  new Database(path.join(__dirname, 'data/landslide_v2.mbtiles'), { readonly: true }),
    avalanche:  new Database(path.join(__dirname, 'data/hzd-afg-ls_lav_100RP.mbtiles'), { readonly: true }),
    earthquake: new Database(path.join(__dirname, 'data/afg_eq-GEM.mbtiles'), { readonly: true }),
};

module.exports = { db, mbtilesDb }; 