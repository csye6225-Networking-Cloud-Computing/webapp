const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

// Check if environment variables are properly loaded
if (!process.env.DB_NAME || !process.env.DB_USER || !process.env.DB_HOST || process.env.DB_PASSWORD === undefined) {
  console.error('Database connection details are missing. Please check your environment variables.');
  process.exit(1); // Exit the process if essential variables are missing
}

// Log environment variables for debugging (Optional - Do not log sensitive information in production)
console.log(`Connecting to database:
  DB_HOST: ${process.env.DB_HOST},
  DB_USER: ${process.env.DB_USER},
  DB_NAME: ${process.env.DB_NAME},
  DB_PORT: ${process.env.DB_PORT || '3306'}`);

// Handle the case where DB_PASSWORD is "EMPTY" (set in GitHub Secrets) or undefined
const dbPassword = process.env.DB_PASSWORD === 'EMPTY' || !process.env.DB_PASSWORD ? '' : process.env.DB_PASSWORD;

// Initialize Sequelize instance with MySQL connection
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  dbPassword, // Use the adjusted password here
  {
    host: process.env.DB_HOST,
    dialect: 'mysql',
    port: process.env.DB_PORT || '3306', // Fallback to default port 3306 if DB_PORT is not set
    logging: false, // Disable SQL query logging for better performance
    pool: {
      max: 10,  // Maximum number of connections in the pool
      min: 0,   // Minimum number of connections in the pool
      idle: 10000 // Maximum time (in milliseconds) a connection can be idle before being released
    }
  }
);

// Test the database connection
sequelize.authenticate()
  .then(() => {
    console.log('Database connection has been established successfully.');
  })
  .catch(err => {
    console.error('Unable to connect to the database:', err.message);
    process.exit(1); // Exit if the connection fails
  });

module.exports = { sequelize };
