const express = require('express');
const router = express.Router();
const { sequelize } = require('../config/database');

// Allowed headers for the /healthz endpoint
const allowedHeaders = ['user-agent', 'accept', 'host', 'accept-encoding', 'connection', 'postman-token'];

// 405 Method Not Allowed for unsupported methods (PUT, POST, PATCH, DELETE, OPTIONS, HEAD)
const unsupportedMethods = ['PUT', 'POST', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'];

unsupportedMethods.forEach((method) => {
    router[method.toLowerCase()]('/', (req, res) => {
        res.set('Allow', 'GET'); // Specify that only GET is allowed
        return res.status(405).end(); // Return 405 with no message
    });
});

// Health check route
router.get('/', async (req, res) => {
    try {
        // Check for query parameters
        if (Object.keys(req.query).length > 0) {
            return res.status(400).send(); // 400 Bad Request if query params are present
        }

        // Define and check allowed headers
        const requestHeaders = Object.keys(req.headers);
        const disallowedHeaders = requestHeaders.filter(header => !allowedHeaders.includes(header));

        if (disallowedHeaders.length > 0) {
            res.set({
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'X-Content-Type-Options': 'nosniff'
            });
            return res.status(400).send(); // 400 Bad Request if disallowed headers are present
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
