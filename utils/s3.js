// utils/s3.js
const AWS = require('aws-sdk');

// Configure AWS SDK globally with the region from environment variables
AWS.config.update({
  region: process.env.AWS_REGION || 'us-east-1', // Default to 'us-east-1' if AWS_REGION is not set
});

const s3 = new AWS.S3();

const uploadImageToS3 = async (userId, file) => {
    const params = {
        Bucket: process.env.S3_BUCKET_NAME,
        Key: `profile-pictures/${userId}/${Date.now()}-${file.originalname}`, // Ensure unique file name
        Body: file.buffer,
        ContentType: file.mimetype
    };
    return await s3.upload(params).promise();
};

const deleteImageFromS3 = async (fileUrl) => {
    const fileKey = fileUrl.split('.com/')[1]; // Extract the key from the URL
    const params = {
        Bucket: process.env.S3_BUCKET_NAME,
        Key: fileKey
    };
    return await s3.deleteObject(params).promise();
};

module.exports = { uploadImageToS3, deleteImageFromS3 };
