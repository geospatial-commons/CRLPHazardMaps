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
    landslide:  new Database(path.join(__dirname, 'data/landslide_20rp.mbtiles'), { readonly: true }),
    avalanche:  new Database(path.join(__dirname, 'data/avalanche_100rp.mbtiles'), { readonly: true }),
    earthquake: new Database(path.join(__dirname, 'data/v2023_1_pga_475_rock_3min_afg_rc_3857.mbtiles'), { readonly: true }),
    contours :  new Database(path.join(__dirname, 'data/contours.mbtiles'), { readonly: true })
};

module.exports = { db, mbtilesDb }; 