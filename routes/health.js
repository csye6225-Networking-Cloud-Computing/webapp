const express = require('express');
const { sequelize } = require('../config/database');

const router = express.Router();

// Health check endpoint
router.get('/', async (req, res) => {
    try {
        // Check if there's any payload in the request
        if (req.headers['content-length'] > 0) {
            return res.status(400).send(); // Send status 400 with no payload
        }

        // Test database connection via Sequelize
        await sequelize.authenticate();

        // Set headers
        res.set({
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'X-Content-Type-Options': 'nosniff'
        });

        res.status(200).send(); // Send status 200 with no payload
    } catch (error) {
        console.error('Database connection failed:', error);
        res.set({
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'X-Content-Type-Options': 'nosniff'
        });
        res.status(503).send(); // Send status 503 with no payload
    }
});

module.exports = router;
