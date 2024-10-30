const express = require('express');
const bcrypt = require('bcryptjs');
const AWS = require('aws-sdk');
const multer = require('multer');
const moment = require('moment-timezone');
const User = require('../models/user');
const ProfilePicture = require('../models/profilePicture'); // Import ProfilePicture model
const authenticate = require('../middleware/authenticate');
const { sequelize } = require('../config/database');

const router = express.Router();
const s3 = new AWS.S3({
  region: process.env.AWS_REGION || 'us-east-1',
});
const bucketName = process.env.S3_BUCKET_NAME; // Ensure this is set in your environment

// Set up multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Limit file size to 5 MB
  fileFilter: (req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/jpg'].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only .jpg, .jpeg, and .png formats allowed!'), false);
    }
  },
});

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

// POST /v1/user/self/pic - Upload profile picture
router.post('/self/pic', authenticate, checkDatabaseConnection, upload.single('profilePic'), async (req, res) => {
  const userId = req.user.id;

  try {
    // Check if the user already has a profile picture
    const existingPicture = await ProfilePicture.findOne({ where: { userId } });
    if (existingPicture) {
      // If the user already has a profile picture, return 400 Bad Request
      return res.status(400).json({ error: 'Profile picture already exists. Delete it before uploading a new one.' });
    }

    // Generate a unique file name for the S3 object
    const fileName = `${Date.now()}-${req.file.originalname}`;
    const uploadParams = {
      Bucket: bucketName,
      Key: `user-profile-pics/${userId}/${fileName}`, // Unique key for each file
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
      Metadata: {
        userId: String(userId),
      },
    };

    // Upload the file to S3
    const data = await s3.upload(uploadParams).promise();
    const imageUrl = data.Location;

    // Create a new record in ProfilePicture table
    const profilePicture = await ProfilePicture.create({
      userId,
      url: imageUrl,
      key: uploadParams.Key,
      metadata: {
        file_name: req.file.originalname,
        content_type: req.file.mimetype,
        upload_date: new Date().toISOString(),
      },
    });

    // Return the response in the specified format
    res.status(201).json({
      file_name: req.file.originalname,
      id: profilePicture.id,
      url: imageUrl,
      upload_date: new Date().toISOString(),
      user_id: userId,
    });
  } catch (error) {
    console.error('Error uploading profile picture:', error);
    res.status(500).json({ error: 'Error uploading profile picture' });
  }
});

// GET /v1/user/self/pic - Retrieve profile picture metadata
router.get('/self/pic', authenticate, checkDatabaseConnection, async (req, res) => {
  try {
    const profilePicture = await ProfilePicture.findOne({ where: { userId: req.user.id } });
    if (!profilePicture) {
      return res.status(404).json({ error: 'Profile picture not found' });
    }
    res.status(200).json({
      profilePicUrl: profilePicture.url,
      profilePicMetadata: profilePicture.metadata,
      message: 'Profile picture metadata retrieved successfully',
    });
  } catch (error) {
    console.error('Error retrieving profile picture metadata:', error);
    res.status(500).json({ error: 'Error retrieving profile picture metadata' });
  }
});

// DELETE /v1/user/self/pic - Delete profile picture
router.delete('/self/pic', authenticate, checkDatabaseConnection, async (req, res) => {
  try {
    const profilePicture = await ProfilePicture.findOne({ where: { userId: req.user.id } });
    if (!profilePicture) {
      return res.status(404).json({ error: 'Profile picture not found' });
    }

    const deleteParams = {
      Bucket: bucketName,
      Key: profilePicture.key,
    };

    await s3.deleteObject(deleteParams).promise();

    // Remove the profile picture record from the database
    await profilePicture.destroy();

    res.status(204).end();
  } catch (error) {
    console.error('Error deleting profile picture:', error);
    res.status(500).json({ error: 'Error deleting profile picture' });
  }
});

// POST /v1/users - Create a new user
router.post('/', checkDatabaseConnection, async (req, res) => {
  const { first_name, last_name, password, email } = req.body;

  if (!email || !emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }
  if (!first_name || !nameRegex.test(first_name)) {
    return res.status(400).json({ error: 'Invalid first name' });
  }
  if (!last_name || !nameRegex.test(last_name)) {
    return res.status(400).json({ error: 'Invalid last name' });
  }
  if (!password) {
    return res.status(400).json({ error: 'Password is required' });
  }

  try {
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already in use' });
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
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /v1/users/self - Retrieve authenticated user's info
router.get('/self', authenticate, checkDatabaseConnection, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { password: _, ...userResponse } = user.toJSON();
    const estUserResponse = convertToEST(userResponse);

    res.status(200).json(estUserResponse);
  } catch (error) {
    console.error('Error retrieving user info:', error);
    res.status(500).json({ error: 'Internal server error' });
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
