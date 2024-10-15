const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

// Handle the case where DB_PASSWORD is "EMPTY" (set in GitHub Secrets)
const dbPassword = process.env.DB_PASSWORD === 'EMPTY' ? '' : process.env.DB_PASSWORD;

// Debugging: Print the database configuration to verify the credentials
console.log("DB Configuration: ", {
  database: process.env.DB_NAME,
  username: process.env.DB_USER,
  password: dbPassword ? '(password provided)' : '(no password)',
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
});

// Initialize Sequelize instance with MySQL connection
const sequelize = new Sequelize(
    process.env.DB_NAME,           // Database name
    process.env.DB_USER,           // Database user
    dbPassword,                    // Database password
    {
        host: process.env.DB_HOST, // Database host
        dialect: 'mysql',
        logging: false,            // Disable SQL query logging
        pool: {
            max: 10,  
            min: 0,   
            idle: 10000 
        }
    }
);

module.exports = { sequelize };
