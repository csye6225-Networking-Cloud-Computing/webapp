// utils/s3.js
const AWS = require('aws-sdk');
const statsdClient = require('../config/statsd'); // Ensure statsdClient is correctly initialized
const { logMetric } = require('./metrics'); // Assuming you have a metrics utility file with logMetric
const logger = require('./logger'); // Assuming you have a logger utility

// Configure AWS SDK globally with the region from environment variables
AWS.config.update({
  region: process.env.AWS_REGION || 'us-east-1', // Default to 'us-east-1' if AWS_REGION is not set
});

const s3 = new AWS.S3();

const timedS3Operation = async (operation, params) => {
    const start = Date.now();
    try {
        const result = await s3[operation](params).promise();
        const duration = Date.now() - start;
        logMetric(`S3${operation.charAt(0).toUpperCase() + operation.slice(1)}`, duration);  // Logs to CloudWatch
        statsdClient.timing(`s3.${operation}.execution_time`, duration);  // Logs to StatsD
        return result;
    } catch (error) {
        logger.error(`S3 ${operation} operation failed:`, error);
        throw error; // Re-throw the error after logging
    }
};

const uploadImageToS3 = async (userId, file) => {
    if (!process.env.S3_BUCKET_NAME) {
        throw new Error('S3_BUCKET_NAME environment variable is not set');
    }
    const params = {
        Bucket: process.env.S3_BUCKET_NAME,
        Key: `profile-pictures/${userId}/${Date.now()}-${file.originalname}`, // Ensure unique file name
        Body: file.buffer,
        ContentType: file.mimetype
    };
    try {
        return await timedS3Operation('upload', params);
    } catch (error) {
        logger.error('Failed to upload image to S3:', error);
        throw error;
    }
};

const deleteImageFromS3 = async (fileUrl) => {
    if (!process.env.S3_BUCKET_NAME) {
        throw new Error('S3_BUCKET_NAME environment variable is not set');
    }
    const fileKey = fileUrl.split('.com/')[1]; // Extract the key from the URL
    const params = {
        Bucket: process.env.S3_BUCKET_NAME,
        Key: fileKey
    };
    try {
        return await timedS3Operation('deleteObject', params);
    } catch (error) {
        logger.error('Failed to delete image from S3:', error);
        throw error;
    }
};

module.exports = { uploadImageToS3, deleteImageFromS3 };