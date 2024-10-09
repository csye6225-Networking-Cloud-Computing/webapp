const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

// Debugging logs to check if environment variables are being loaded correctly
console.log("DB_HOST:", process.env.DB_HOST);
console.log("DB_USER:", process.env.DB_USER);
console.log("DB_PASSWORD:", process.env.DB_PASSWORD);
console.log("DB_NAME:", process.env.DB_NAME);
console.log("DB_PORT:", process.env.DB_PORT);

// Check for "EMPTY" and replace with an actual empty string for DB_PASSWORD
const dbPassword = process.env.DB_PASSWORD === 'EMPTY' ? '' : process.env.DB_PASSWORD;

// Initialize Sequelize instance with MySQL connection
const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    dbPassword, // Use the adjusted password here
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

// Export the Sequelize instance
module.exports = { sequelize };
