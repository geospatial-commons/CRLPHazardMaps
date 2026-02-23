const express = require('express');
const path = require('path');

const app = express();
const PORT = 3000;

// Serve all static files (HTML, JS, CSS) from project root
app.use(express.static(__dirname));

// Serve public folder (GeoJSON, raster files, etc.)
app.use('/data', express.static(path.join(__dirname, 'public/data')));

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
