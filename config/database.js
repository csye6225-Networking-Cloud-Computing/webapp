const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

// Adjust the password if it's the placeholder value
const dbPassword = process.env.DB_PASSWORD === 'EMPTY_PASSWORD' ? '' : process.env.DB_PASSWORD;

// Initialize Sequelize instance with MySQL connection
const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    dbPassword, // Use adjusted password here
    {
        host: process.env.DB_HOST,
        dialect: 'mysql',
        logging: false, // Disable SQL query logging
        pool: {
            max: 10,  
            min: 0,   
            idle: 10000 
        }
    }
);

module.exports = { sequelize };