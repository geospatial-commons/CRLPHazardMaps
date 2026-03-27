const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files (CSS, client JS, images, etc.)
app.use(express.static(path.join(__dirname, 'public')));

// Import routes
const routes = require('./routes/routes');

// Use routes
app.use('/', routes);

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running and accepting outside connections on port ${PORT}`);
});
