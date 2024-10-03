const express = require('express');
const bcrypt = require('bcrypt');
const User = require('../models/user');
const authenticate = require('../middleware/authenticate');
const moment = require('moment-timezone');  // Import moment-timezone for timezone conversion
const router = express.Router();
const { sequelize } = require('../config/database'); // Import sequelize for DB check

// Utility function to convert timestamps to EST/EDT
const convertToEST = (user) => {
  if (user.account_created) {
    user.account_created = moment(user.account_created).tz('America/New_York').format();
  }
  if (user.account_updated) {
    user.account_updated = moment(user.account_updated).tz('America/New_York').format();
  }
  return user;
};

// Middleware to check database connection and return 503 if down
const checkDatabaseConnection = async (req, res, next) => {
  try {
    await sequelize.authenticate();
    next(); // Proceed if DB is connected
  } catch (error) {
    return res.status(503).end(); // No message, just 503 Service Unavailable
  }
};

// Regular expressions for validation
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;  // Basic email format validation
const nameRegex = /^[a-zA-Z0-9]+$/;  // Alphanumeric validation for first name and last name

// Handle unsupported methods (DELETE, PATCH, OPTIONS, HEAD) for /v1/users/self
const unsupportedMethods = ['DELETE', 'PATCH', 'OPTIONS', 'HEAD'];

unsupportedMethods.forEach((method) => {
  router[method.toLowerCase()]('/self', (req, res) => {
    res.set('Allow', 'GET, PUT');  // Specify the allowed methods
    return res.status(405).end();  // Return 405 Method Not Allowed without a message
  });
});

// Handle OPTIONS requests explicitly
router.options('/self', (req, res) => {
  res.set('Allow', 'GET, PUT');  // Specify the allowed methods for preflight
  return res.status(405).end();  // Return 405 Method Not Allowed
});

// POST /v1/users - Create a new user
// POST /v1/users - Create a new user
router.post('/', checkDatabaseConnection, async (req, res) => {
  const { first_name, last_name, password, email, account_created, account_updated, ...rest } = req.body;

  // Ensure there are no query parameters
  if (Object.keys(req.query).length > 0) {
    return res.status(400).end();  // Return 400 if query parameters are present
  }

  // Ensure there is no Authorization header (Basic Auth) in the request
  if (req.headers['authorization']) {
    return res.status(400).end();  // Return 400 if Authorization header is present
  }

  // Validate that only the allowed fields are present
  const allowedFields = ['first_name', 'last_name', 'password', 'email'];

  // If there are any extra fields in the body (apart from allowed ones and ignored account_*), throw 400
  const invalidFields = Object.keys(rest).filter(field => !allowedFields.includes(field));
  if (invalidFields.length > 0) {
    return res.status(400).end();  // Return 400 if any invalid fields are present
  }

  // Validate the email format and that first/last names are alphanumeric
  if (!email || !emailRegex.test(email)) {
    return res.status(400).end();  // Return 400 Bad Request if email is invalid or missing
  }
  if (!first_name || !nameRegex.test(first_name)) {
    return res.status(400).end();  // Return 400 Bad Request if first_name is invalid or missing
  }
  if (!last_name || !nameRegex.test(last_name)) {
    return res.status(400).end();  // Return 400 Bad Request if last_name is invalid or missing
  }
  if (!password) {
    return res.status(400).end();  // Return 400 Bad Request if password is missing
  }

  try {
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).end();  // Return 400 Bad Request if user already exists
    }

    // Create a new user, ignoring `account_created` and `account_updated` in the request body
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({
      email,
      password: hashedPassword,
      firstName: first_name,
      lastName: last_name,
      account_created: new Date(),  // Always set these fields manually
      account_updated: new Date(),  // Always set these fields manually
    });

    const { password: _, ...userResponse } = newUser.toJSON();
    const estUserResponse = convertToEST(userResponse);  // Convert timestamps to EST

    res.status(201).json(estUserResponse);
  } catch (error) {
    res.status(500).end();  // Return 500 Server Error without a message
  }
});


// GET /v1/users/self - Retrieve the authenticated user's information
router.get('/self', authenticate, checkDatabaseConnection, async (req, res) => {
  // Ensure there is no request body or query parameters
  if (Object.keys(req.query).length > 0 || Object.keys(req.body).length > 0) {
    return res.status(400).end();  // Return 400 if there are query parameters or body
  }

  try {
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).end();  // Return 404 if user is not found
    }

    const { password: _, ...userResponse } = user.toJSON();  // Exclude password
    const estUserResponse = convertToEST(userResponse);      // Convert timestamps to EST

    res.status(200).json(estUserResponse);  // Return 200 OK with user info in the response body
  } catch (error) {
    res.status(500).end();  // Return 500 Internal Server Error with no body
  }
});


// PUT /v1/users/self - Update the authenticated user's information
router.put('/self', authenticate, checkDatabaseConnection, async (req, res) => {
  // Ensure there are no query parameters
  if (Object.keys(req.query).length > 0) {
    return res.status(400).end();  // Return 400 if query parameters are present
  }

  const { first_name, last_name, password } = req.body;

  // Get a list of allowed fields for updates
  const allowedFields = ['first_name', 'last_name', 'password'];

  // Check if any fields other than first_name, last_name, or password are being updated
  const attemptedUpdates = Object.keys(req.body).filter(field => !allowedFields.includes(field));

  // If there are any invalid fields being updated, return 400 Bad Request
  if (attemptedUpdates.length > 0) {
    return res.status(400).end();  // Just return 400 without a message
  }

  // Validate that first/last names are alphanumeric if they are present
  if ((first_name && !nameRegex.test(first_name)) || (last_name && !nameRegex.test(last_name))) {
    return res.status(400).end();  // Just return 400 without a message
  }

  try {
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).end();  // Just return 404 without a message
    }

    // Update first name and last name if provided
    if (first_name) user.firstName = first_name;
    if (last_name) user.lastName = last_name;

    // If the user provides a new password, hash it before saving
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      user.password = hashedPassword;
    }

    // Automatically update the account_updated field
    user.account_updated = new Date();
    await user.save();

    res.status(204).end();  // Return 204 No Content for a successful update
  } catch (error) {
    res.status(500).end();  // Just return 500 without a message
  }
});



module.exports = router;
