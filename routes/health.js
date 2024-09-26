const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  //Check for query parameters
  if (Object.keys(req.query).length > 0) {
    return res.status(400).send(); //400 Bad Request if query params are present
  }

  //Define allowed headers
  const allowedHeaders = ['user-agent', 'accept', 'host', 'accept-encoding', 'connection', 'postman-token'];
  const requestHeaders = Object.keys(req.headers);

  //Filter out disallowed headers
  const disallowedHeaders = requestHeaders.filter(header => !allowedHeaders.includes(header));

  if (disallowedHeaders.length > 0) {
    //Send 400 Bad Request if disallowed headers are present
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'X-Content-Type-Options': 'nosniff'
    });
    return res.status(400).send(); 
  }

  //Send 200 OK if no disallowed headers and no query parameters
  return res.status(200).send(); //200 OK
});

module.exports = router;
