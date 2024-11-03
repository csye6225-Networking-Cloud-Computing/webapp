const express = require('express');
const router = express.Router();
const { sequelize } = require('../config/database');

// Health check route
router.get('/', async (req, res) => {
    try {
        // Check database connection
        await sequelize.authenticate();
        
        // Set no-cache headers
        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('X-Content-Type-Options', 'nosniff');

        return res.status(200).end(); // 200 OK if connection is successful
    } catch (error) {
        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        return res.status(503).end(); // 503 Service Unavailable if DB connection fails
    }
});

// Handle unsupported methods with 405
router.all('*', (req, res) => {
    res.set('Allow', 'GET'); // Specify that only GET is allowed
    return res.status(405).end(); // Return 405 for unsupported methods
});

module.exports = router;
