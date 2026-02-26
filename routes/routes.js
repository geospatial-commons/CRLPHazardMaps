const express = require('express');
const path = require('path');
const router = express.Router();

// Landing page route
router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'views', 'landing.html'));
});

// App route
router.get('/app', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'views', 'index.html'));
});

module.exports = router;