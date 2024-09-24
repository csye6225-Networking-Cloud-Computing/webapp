const express = require('express');
const { sequelize } = require('../config/database');

const router = express.Router();

// Middleware to check the database connection for all routes
router.use(async (req, res, next) => {
    try {
        // Test database connection via Sequelize
        await sequelize.authenticate();
        next(); // Proceed to the next middleware/route handler
    } catch (error) {
        console.error('Database connection failed:', error.message);
        res.set({
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'X-Content-Type-Options': 'nosniff'
        });
        return res.status(503).send(); // Send 503 for all methods if DB is down
    }
});

// Health check endpoint for GET request
router.get('/', (req, res) => {
    // Check if the request contains a body
    if (req.headers['content-length'] > 0) {
        return res.status(400).send(); // Send 400 if request contains a payload
    }

    res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Content-Type-Options': 'nosniff'
    });
    return res.status(200).send(); // Send 200 OK if the DB connection is fine
});

module.exports = router;
