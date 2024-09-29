const express = require('express');
const router = express.Router();
const { sequelize } = require('../config/database');

// Health check route
router.get('/', async (req, res) => {
    try {
        // Check for query parameters
        if (Object.keys(req.query).length > 0) {
            return res.status(400).send(); // 400 Bad Request if query params are present
        }

        // Define and check allowed headers
        const allowedHeaders = ['user-agent', 'accept', 'host', 'accept-encoding', 'connection', 'postman-token'];
        const requestHeaders = Object.keys(req.headers);
        const disallowedHeaders = requestHeaders.filter(header => !allowedHeaders.includes(header));

        if (disallowedHeaders.length > 0) {
            res.set({
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'X-Content-Type-Options': 'nosniff'
            });
            return res.status(400).send(); 
        }

        // Check database connection
        await sequelize.authenticate();
        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        return res.status(200).end(); // 200 OK if connection is successful

    } catch (error) {
        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        return res.status(503).end(); // 503 Service Unavailable if DB connection fails
    }
});

module.exports = router;
