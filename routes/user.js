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
router.post('/', checkDatabaseConnection, async (req, res) => {
  const { first_name, last_name, password, email } = req.body;

  // Validate the email format and that first/last names are alphanumeric
  if (!emailRegex.test(email)) {
    return res.status(400).end();  // Return 400 Bad Request without a message
  }
  if (!nameRegex.test(first_name) || !nameRegex.test(last_name)) {
    return res.status(400).end();  // Return 400 Bad Request without a message
  }

  try {
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).end();  // Return 400 Bad Request if user already exists without a message
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({
      email,
      password: hashedPassword,
      firstName: first_name,
      lastName: last_name,
      account_created: new Date(),
      account_updated: new Date(),
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
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { password: _, ...userResponse } = user.toJSON();
    const estUserResponse = convertToEST(userResponse);  // Convert timestamps to EST

    res.status(200).json(estUserResponse);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// PUT /v1/users/self - Update the authenticated user's information
router.put('/self', authenticate, checkDatabaseConnection, async (req, res) => {
  const { first_name, last_name, password } = req.body;

  // Validate that first/last names are alphanumeric
  if ((first_name && !nameRegex.test(first_name)) || (last_name && !nameRegex.test(last_name))) {
    return res.status(400).json({ message: 'First and last name must be alphanumeric' });
  }

  try {
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent updates to email, account_created, account_updated
    const restrictedFields = ['email', 'account_created', 'account_updated'];
    const attemptedUpdates = Object.keys(req.body).filter(field => restrictedFields.includes(field));

    if (attemptedUpdates.length > 0) {
      return res.status(400).json({ message: `You cannot update the following fields: ${attemptedUpdates.join(', ')}` });
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
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
