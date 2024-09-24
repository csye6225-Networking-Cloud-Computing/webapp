const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

// Initialize Sequelize
const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST,
        logging: false, // Disable logging
        dialect: 'mysql', // Using MySQL as the dialect
        pool: {
            max: 10, // Maximum connections in the pool
            min: 0,  // Minimum connections in the pool
            idle: 10000 // Duration (in ms) to keep idle connections
        }
    }
);

module.exports = { sequelize };
