const express = require('express');

const router = express.Router();

//Health check endpoint for GET request
router.get('/', (req, res) => {
    //Check if the request contains query parameters
    if (Object.keys(req.query).length > 0 || req.headers['content-length'] > 0) {
        res.set({
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'X-Content-Type-Options': 'nosniff'
        });
        return res.status(400).send(); //Send 400 if query params or body payload is present
    }

    //Get all request headers
    const requestHeaders = Object.keys(req.headers);

    //Check if any headers are present
    if (requestHeaders.length > 0) {
        res.set({
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'X-Content-Type-Options': 'nosniff'
        });
        return res.status(400).send(); //Send 400 if any headers are present
    }

    //If no query params, body, or headers are present, return 200 OK
    res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'X-Content-Type-Options': 'nosniff'
    });
    return res.status(200).send(); //Send 200 OK if everything is fine
});

module.exports = router;
