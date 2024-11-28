const express = require('express');
const bcrypt = require('bcryptjs');
const AWS = require('aws-sdk');
const axios = require('axios');
const multer = require('multer');
const moment = require('moment-timezone');
const User = require('../models/user');
const ProfilePicture = require('../models/profilePicture');
const authenticate = require('../middleware/authenticate');
const { sequelize } = require('../config/database');
const StatsD = require('node-statsd');
const crypto = require('crypto');
const router = express.Router();

const s3 = new AWS.S3({ region: process.env.AWS_REGION || 'us-east-1' });
const statsdClient = new StatsD({ host: process.env.STATSD_HOST || 'localhost', port: 8125 });
const bucketName = process.env.S3_BUCKET_NAME;

const sns = new AWS.SNS({ region: process.env.AWS_REGION });

const publishVerificationMessage = async (userId, email, token) => {
  let baseURL = process.env.BASE_URL || 'demo.csyeproject.me';
  if (!baseURL.startsWith('http://') && !baseURL.startsWith('https://')) {
    baseURL = `http://${baseURL}`;
  }
  const activationLink = `${baseURL}/v1/user/verify?user=${encodeURIComponent(userId)}&token=${encodeURIComponent(token)}`;
  console.log('UserId:', userId);
  console.log('Token:', token);
  console.log('Verification Link:', activationLink);
  const message = JSON.stringify({ userId, email, token, activationLink });
  const params = {
    Message: message,
    TopicArn: process.env.SNS_TOPIC_ARN,
  };
  try {
    console.log('Publishing message to SNS:', params);
    await sns.publish(params).promise();
    console.log('Message published successfully');
  } catch (error) {
    console.error(`Failed to publish verification message for user ${email}:`, error);
  }
};

const checkDatabaseConnection = async (req, res, next) => {
  try {
    await sequelize.authenticate();
    next();
  } catch (error) {
    return res.status(503).end();
  }
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const nameRegex = /^[A-Za-z]+$/;
const TOKEN_EXPIRATION_TIME = 2 * 60 * 1000;

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/jpg'].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only .jpg, .jpeg, and .png formats allowed!'), false);
    }
  },
});

const convertToEST = (timestamp) => moment(timestamp).tz('America/New_York').format();

let metadataToken = null;
let tokenExpirationTime = null;
let instanceId = 'localhost';

async function getMetadataToken() {
  const currentTime = Date.now();
  if (metadataToken && currentTime < tokenExpirationTime) {
    return metadataToken;
  }
  try {
    const response = await axios.put(
      'http://169.254.169.254/latest/api/token',
      null,
      { headers: { 'X-aws-ec2-metadata-token-ttl-seconds': '21600' } }
    );
    metadataToken = response.data;
    tokenExpirationTime = currentTime + 21600 * 1000;
    return metadataToken;
  } catch (error) {
    console.warn("Could not retrieve IMDSv2 token. Using 'localhost' as Instance ID.");
    return null;
  }
}

async function fetchInstanceId() {
  try {
    const token = await getMetadataToken();
    if (!token) return;
    const instanceResponse = await axios.get(
      'http://169.254.169.254/latest/meta-data/instance-id',
      { headers: { 'X-aws-ec2-metadata-token': token } }
    );
    instanceId = instanceResponse.data;
  } catch (error) {
    console.warn("Could not retrieve Instance ID. Using 'localhost' as fallback.");
  }
}

fetchInstanceId();

const logMetric = (metricName, value, unit = 'Milliseconds') => {
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    console.warn(`Skipping metric ${metricName} due to missing AWS credentials.`);
    return;
  }
  const params = {
    MetricData: [
      {
        MetricName: metricName,
        Dimensions: [{ Name: 'InstanceId', Value: instanceId }],
        Unit: unit,
        Value: value,
      },
    ],
    Namespace: 'WebAppMetrics',
  };
  const cloudwatch = new AWS.CloudWatch();
  cloudwatch.putMetricData(params, (err) => {
    if (err) console.error(`Failed to push metric ${metricName}: ${err}`);
  });
};

const timedOperation = async (operation, metricPrefix) => {
  const start = Date.now();
  const result = await operation();
  const duration = Date.now() - start;
  logMetric(`${metricPrefix}_ExecutionTime`, duration);
  statsdClient.timing(`${metricPrefix}.execution_time`, duration);
  return result;
};

router.use((req, res, next) => {
  const start = Date.now();
  statsdClient.increment(`api.${req.method.toLowerCase()}.${req.path.replace(/\//g, '_')}.count`);
  res.on('finish', () => {
    const duration = Date.now() - start;
    logMetric(`API_${req.method}_${req.path}_ExecutionTime`, duration);
    statsdClient.timing(`api.${req.method.toLowerCase()}.${req.path.replace(/\//g, '_')}.execution_time`, duration);
  });
  next();
});

const validateNoBodyOrParams = (req, res, next) => {
  if (Object.keys(req.body).length > 0 || Object.keys(req.query).length > 0) {
    return res.status(400).end();
  }
  next();
};

const checkVerificationStatus = (req, res, next) => {
  if (!req.user.verified) {
    return res.status(403).end();
  }
  next();
};

router.post('/self/pic', authenticate, checkDatabaseConnection, checkVerificationStatus, upload.single('profilePic'), async (req, res) => {
  const userId = req.user.id;
  try {
    const existingPicture = await timedOperation(() => ProfilePicture.findOne({ where: { userId } }), 'DBQuery');
    if (existingPicture) {
      return res.status(400).end();
    }
    const fileName = `${Date.now()}-${req.file.originalname}`;
    const uploadParams = {
      Bucket: bucketName,
      Key: `user-profile-pics/${userId}/${fileName}`,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
      Metadata: { userId: String(userId) },
    };
    const data = await timedOperation(() => s3.upload(uploadParams).promise(), 'S3Upload');
    const profilePicture = await timedOperation(() => ProfilePicture.create({
      userId,
      url: data.Location,
      key: uploadParams.Key,
      metadata: {
        file_name: req.file.originalname,
        content_type: req.file.mimetype,
        upload_date: new Date().toISOString(),
      },
    }), 'DBQuery');
    res.status(201).json({
      file_name: req.file.originalname,
      id: profilePicture.id,
      url: data.Location,
      upload_date: convertToEST(new Date()),
      user_id: userId,
    });
  } catch (error) {
    res.status(500).end();
  }
});

router.get('/self/pic', validateNoBodyOrParams, authenticate, checkDatabaseConnection, checkVerificationStatus, async (req, res) => {
  try {
    const profilePicture = await timedOperation(() => ProfilePicture.findOne({ where: { userId: req.user.id } }), 'DBQuery');
    if (!profilePicture) {
      return res.status(404).end();
    }
    res.status(200).json({
      file_name: profilePicture.metadata.file_name,
      id: profilePicture.id,
      url: profilePicture.url,
      upload_date: convertToEST(profilePicture.metadata.upload_date),
      user_id: req.user.id,
    });
  } catch (error) {
    res.status(500).end();
  }
});

router.delete('/self/pic', authenticate, checkDatabaseConnection, checkVerificationStatus, async (req, res) => {
  try {
    const profilePicture = await timedOperation(() => ProfilePicture.findOne({ where: { userId: req.user.id } }), 'DBQuery');
    if (!profilePicture) {
      return res.status(404).end();
    }
    const deleteParams = {
      Bucket: bucketName,
      Key: profilePicture.key,
    };
    await timedOperation(() => s3.deleteObject(deleteParams).promise(), 'S3Delete');
    await timedOperation(() => profilePicture.destroy(), 'DBQuery');
    res.status(204).end();
  } catch (error) {
    res.status(500).end();
  }
});

router.post('/', checkDatabaseConnection, async (req, res) => {
  const { first_name, last_name, password, email } = req.body;
  if (
    !email || !emailRegex.test(email) ||
    !first_name || !nameRegex.test(first_name) ||
    !last_name || !nameRegex.test(last_name) ||
    !password
  ) {
    return res.status(400).end();
  }
  try {
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).end();
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const token = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRATION_TIME);
    const newUser = await User.create({
      email,
      password: hashedPassword,
      firstName: first_name,
      lastName: last_name,
      account_created: new Date(),
      account_updated: new Date(),
      verified: false,
      verification_token: token,
      token_expires_at: expiresAt,
    });
    await publishVerificationMessage(newUser.id, newUser.email, token);
    const { password: _, verification_token: __, token_expires_at: ___, verified: ____, ...userResponse } = newUser.toJSON();
    res.status(201).json({
      ...userResponse,
      account_created: convertToEST(newUser.account_created),
      account_updated: convertToEST(newUser.account_updated),
    });
  } catch (error) {
    res.status(500).end();
  }
});

router.get('/self', validateNoBodyOrParams, authenticate, checkDatabaseConnection, async (req, res) => {
  try {
    const user = await timedOperation(() => User.findByPk(req.user.id), 'DBQuery');
    if (!user) {
      return res.status(404).end();
    }
    if (!user.verified) {
      return res.status(403).end();
    }
    const { password: _, verification_token: __, token_expires_at: ___, verified: ____, ...userResponse } = user.toJSON();
    res.status(200).json({
      ...userResponse,
      account_created: convertToEST(user.account_created),
      account_updated: convertToEST(user.account_updated),
    });
  } catch (error) {
    res.status(500).end();
  }
});

router.put('/self', authenticate, checkDatabaseConnection, checkVerificationStatus, async (req, res) => {
  if (Object.keys(req.query).length > 0 || Object.keys(req.body).some(field => !['first_name', 'last_name', 'password'].includes(field))) {
    return res.status(400).end();
  }
  try {
    const user = await timedOperation(() => User.findByPk(req.user.id), 'DBQuery');
    if (!user) {
      return res.status(404).end();
    }
    if (req.body.first_name) user.firstName = req.body.first_name;
    if (req.body.last_name) user.lastName = req.body.last_name;
    if (req.body.password) user.password = await bcrypt.hash(req.body.password, 10);
    user.account_updated = new Date();
    await timedOperation(() => user.save(), 'DBQuery');
    res.status(204).end();
  } catch (error) {
    res.status(500).end();
  }
});

router.get('/verify', checkDatabaseConnection, async (req, res) => {
  const { user: userId, token } = req.query;
  if (!userId || !token) {
    return res.status(400).json({ error: 'Missing user or token' });
  }

  try {
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(400).json({ error: 'User not found' });
    }

    // If the user is already verified, return 200 OK immediately
    if (user.verified) {
      return res.status(200).json({ message: 'User already verified' });
    }

    // Check if the token is valid
    if (user.verification_token !== token) {
      return res.status(400).json({ error: 'Invalid verification token' });
    }

    // Check if the token has expired
    if (new Date(user.token_expires_at) < new Date()) {
      return res.status(403).json({ error: 'Verification link has expired. Please request a new one.' });
    }

    // Mark the user as verified
    user.verified = true;
    user.verification_token = null;
    user.token_expires_at = null;
    await user.save();

    res.status(200).json({ message: 'User verified successfully' });
  } catch (error) {
    console.error('Error verifying user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

