const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');

// Load environment variables from the .env file
dotenv.config();

// Log the current environment variables for debugging
console.log('Environment variables:');
console.log('DB_HOST:', process.env.DB_HOST || 'localhost');
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? '[SET]' : '[NOT SET]');
console.log('DB_NAME:', process.env.DB_NAME);
console.log('DB_PORT:', process.env.DB_PORT || 3306);

// Handle the case where the password is set to "EMPTY_PASSWORD"
const dbPassword = process.env.DB_PASSWORD === 'EMPTY_PASSWORD' ? '' : process.env.DB_PASSWORD;

// Initialize Sequelize with MySQL connection
const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, dbPassword, {
    host: process.env.DB_HOST || 'localhost',
    dialect: 'mysql',
    port: process.env.DB_PORT || 3306,
    logging: false, // Disable SQL query logging in production
    pool: {
        max: 10,
        min: 0,
        idle: 10000
    }
});

// Test the database connection
sequelize.authenticate()
    .then(() => console.log('Database connection has been established successfully.'))
    .catch(err => {
        console.error('Unable to connect to the database. Detailed Error:', JSON.stringify(err, null, 2));
        process.exit(1); // Exit the process if unable to connect
    });

module.exports = { sequelize };
