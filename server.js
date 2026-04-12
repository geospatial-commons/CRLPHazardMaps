require('dotenv').config({ quiet: true });
const express = require('express');
const path = require('path');
const app = express();
const helmet = require('helmet');
//const cors = require('cors');
const rateLimit = require('express-rate-limit');


const PORT = process.env.PORT || 3000;
const IP = process.env.IP || '127.0.0.1';

// Security middleware
// 1. Helmet: Secure HTTP headers
// app.use(helmet());

// 2. CORS: Only allow your frontend domain to access the APIs
const corsOptions = {
    origin: 'https://your-frontend-domain.com', // Replace with your actual domain
    optionsSuccessStatus: 200
};
//app.use(cors(corsOptions)); // Commented out for local testing, enable in production

// 3. Rate Limiting: Prevent scraping and DoS attacks
const tileLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute window
    max: 6000, // Limit each IP to 600 tile requests per minute
    message: "Too many tiles requested, please try again later."
});

const apiLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 200, // Limit each IP to 200 API requests per 5 minutes
    message: "Too many API requests, please try again later."
});


// Nginx parameter for reverse proxy
app.set('trust proxy', 1);

// Apply the limiters to specific route prefixes
app.use('/tiles', tileLimiter);
app.use('/api', apiLimiter);

// Serve static files (CSS, client JS, images, etc.)
app.use(express.static(path.join(__dirname, 'public')));

// Import routes
const routes = require('./routes/routes');

// Use routes
app.use('/', routes);

app.listen(PORT, IP, () => {
    console.log(`Server running and accepting outside connections on port ${PORT}`);
});
