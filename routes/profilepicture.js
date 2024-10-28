// routes/profilePicture.js
const express = require('express');
const multer = require('multer');
const { uploadImageToS3, deleteImageFromS3 } = require('../utils/s3'); // Utility functions to handle S3 operations
const { User } = require('../models/user'); // Assuming you have a User model with profile pic metadata
const router = express.Router();

// Configure multer for file upload
const upload = multer({ storage: multer.memoryStorage() }); // Uses memory storage for simplicity

// POST /v1/user/self/pic - Add or update profile picture
router.post('/self/pic', upload.single('profilePic'), async (req, res) => {
    try {
        const userId = req.user.id; // Assuming req.user is populated with authenticated user info
        const file = req.file;
        
        if (!file) {
            return res.status(400).json({ error: "No file uploaded" });
        }

        // Upload the image to S3
        const s3Result = await uploadImageToS3(userId, file);

        // Update user record with image metadata
        const updatedUser = await User.update(
            { profilePicUrl: s3Result.Location }, 
            { where: { id: userId } }
        );

        return res.status(201).json({
            file_name: file.originalname,
            id: updatedUser.id,
            url: s3Result.Location,
            upload_date: new Date().toISOString(),
            user_id: userId
        });
    } catch (error) {
        console.error("Error uploading profile picture:", error);
        return res.status(500).json({ error: "Error uploading profile picture" });
    }
});

// GET /v1/user/self/pic - Get profile picture metadata
router.get('/self/pic', async (req, res) => {
    try {
        const userId = req.user.id; // Assuming req.user is populated with authenticated user info
        const user = await User.findByPk(userId);

        if (!user || !user.profilePicUrl) {
            return res.status(404).json({ error: "Profile picture not found" });
        }

        return res.status(200).json({
            file_name: user.profilePicName,
            id: user.id,
            url: user.profilePicUrl,
            upload_date: user.profilePicUploadDate,
            user_id: userId
        });
    } catch (error) {
        console.error("Error retrieving profile picture:", error);
        return res.status(500).json({ error: "Error retrieving profile picture" });
    }
});

// DELETE /v1/user/self/pic - Delete profile picture
router.delete('/self/pic', async (req, res) => {
    try {
        const userId = req.user.id; // Assuming req.user is populated with authenticated user info
        const user = await User.findByPk(userId);

        if (!user || !user.profilePicUrl) {
            return res.status(404).json({ error: "Profile picture not found" });
        }

        // Delete image from S3
        await deleteImageFromS3(user.profilePicUrl);

        // Remove the profile picture metadata from user record
        await user.update({ profilePicUrl: null, profilePicName: null, profilePicUploadDate: null });

        return res.status(204).end();
    } catch (error) {
        console.error("Error deleting profile picture:", error);
        return res.status(500).json({ error: "Error deleting profile picture" });
    }
});

module.exports = router;
