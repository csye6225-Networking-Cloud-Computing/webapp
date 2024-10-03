const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/user');
const authenticate = require('../middleware/authenticate');
const moment = require('moment-timezone');
const router = express.Router();
const { sequelize } = require('../config/database');

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
    next();
  } catch (error) {
    return res.status(503).end();
  }
};

// Regular expressions for validation
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const nameRegex = /^[a-zA-Z0-9]+$/;

// Handle unsupported methods for /v1/users/self
const unsupportedMethods = ['DELETE', 'PATCH', 'OPTIONS', 'HEAD'];

unsupportedMethods.forEach((method) => {
  router[method.toLowerCase()]('/self', (req, res) => {
    res.set('Allow', 'GET, PUT');
    return res.status(405).end();
  });
});

router.options('/self', (req, res) => {
  res.set('Allow', 'GET, PUT');
  return res.status(405).end();
});

// POST /v1/users - Create a new user
router.post('/', checkDatabaseConnection, async (req, res) => {
  const { first_name, last_name, password, email, account_created, account_updated, ...rest } = req.body;

  if (Object.keys(req.query).length > 0) {
    return res.status(400).end();
  }

  if (req.headers['authorization']) {
    return res.status(400).end();
  }

  const allowedFields = ['first_name', 'last_name', 'password', 'email'];
  const invalidFields = Object.keys(rest).filter(field => !allowedFields.includes(field));

  if (invalidFields.length > 0) {
    return res.status(400).end();
  }

  if (!email || !emailRegex.test(email)) {
    return res.status(400).end();
  }
  if (!first_name || !nameRegex.test(first_name)) {
    return res.status(400).end();
  }
  if (!last_name || !nameRegex.test(last_name)) {
    return res.status(400).end();
  }
  if (!password) {
    return res.status(400).end();
  }

  try {
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).end();
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
    const estUserResponse = convertToEST(userResponse);

    res.status(201).json(estUserResponse);
  } catch (error) {
    res.status(500).end();
  }
});

// GET /v1/users/self - Retrieve the authenticated user's information
router.get('/self', authenticate, checkDatabaseConnection, async (req, res) => {
  if (Object.keys(req.query).length > 0 || Object.keys(req.body).length > 0) {
    return res.status(400).end();
  }

  try {
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).end();
    }

    const { password: _, ...userResponse } = user.toJSON();
    const estUserResponse = convertToEST(userResponse);

    res.status(200).json(estUserResponse);
  } catch (error) {
    res.status(500).end();
  }
});

// PUT /v1/users/self - Update the authenticated user's information
router.put('/self', authenticate, checkDatabaseConnection, async (req, res) => {
  if (Object.keys(req.query).length > 0) {
    return res.status(400).end();
  }

  const { first_name, last_name, password } = req.body;
  const allowedFields = ['first_name', 'last_name', 'password'];
  const attemptedUpdates = Object.keys(req.body).filter(field => !allowedFields.includes(field));

  if (attemptedUpdates.length > 0) {
    return res.status(400).end();
  }

  if ((first_name && !nameRegex.test(first_name)) || (last_name && !nameRegex.test(last_name))) {
    return res.status(400).end();
  }

  try {
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).end();
    }

    if (first_name) user.firstName = first_name;
    if (last_name) user.lastName = last_name;

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      user.password = hashedPassword;
    }

    user.account_updated = new Date();
    await user.save();

    res.status(204).end();
  } catch (error) {
    res.status(500).end();
  }
});

module.exports = router;
