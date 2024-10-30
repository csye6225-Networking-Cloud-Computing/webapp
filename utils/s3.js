// utils/s3.js
const AWS = require('aws-sdk');
const statsdClient = require('node-statsd'); // Ensure statsdClient is correctly initialized
const { logMetric } = require('../utils/metrics'); // Assuming you have a metrics utility file with logMetric

// Configure AWS SDK globally with the region from environment variables
AWS.config.update({
  region: process.env.AWS_REGION || 'us-east-1', // Default to 'us-east-1' if AWS_REGION is not set
});

const s3 = new AWS.S3();

const timedS3Operation = async (operation, params) => {
    const start = Date.now();
    const result = await s3[operation](params).promise();
    const duration = Date.now() - start;
    logMetric(`S3_${operation}_ExecutionTime`, duration);  // Logs to CloudWatch
    statsdClient.timing(`s3.${operation}.execution_time`, duration);  // Logs to StatsD
    return result;
};

const uploadImageToS3 = async (userId, file) => {
    const params = {
        Bucket: process.env.S3_BUCKET_NAME,
        Key: `profile-pictures/${userId}/${Date.now()}-${file.originalname}`, // Ensure unique file name
        Body: file.buffer,
        ContentType: file.mimetype
    };
    return await timedS3Operation('upload', params);
};

const deleteImageFromS3 = async (fileUrl) => {
    const fileKey = fileUrl.split('.com/')[1]; // Extract the key from the URL
    const params = {
        Bucket: process.env.S3_BUCKET_NAME,
        Key: fileKey
    };
    return await timedS3Operation('deleteObject', params);
};

module.exports = { uploadImageToS3, deleteImageFromS3 };
