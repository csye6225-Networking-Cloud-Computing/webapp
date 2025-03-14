const { Sequelize } = require('sequelize');

// Check if essential environment variables are loaded
if (!process.env.DB_NAME || !process.env.DB_USER || !process.env.DB_HOST || process.env.DB_PASSWORD === undefined) {
  console.error('Database connection details are missing. Please check your environment variables.');
  process.exit(1); // Exit if essential variables are missing
}

// Set DB password to an empty string if the environment variable is set to "EMPTY"
const dbPassword = process.env.DB_PASSWORD === 'EMPTY' ? '' : process.env.DB_PASSWORD;

// Log database connection details (excluding sensitive information)
console.log(`Connecting to database:
  DB_HOST: ${process.env.DB_HOST},
  DB_USER: ${process.env.DB_USER},
  DB_NAME: ${process.env.DB_NAME},
  DB_PORT: ${process.env.DB_PORT || '3306'}`);

// Initialize Sequelize instance with MySQL connection
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  dbPassword,
  {
    host: process.env.DB_HOST,
    dialect: 'mysql',
    port: process.env.DB_PORT || '3306',
    logging: process.env.NODE_ENV !== 'test', // Log queries only if not in test mode
    pool: {
      max: 10,
      min: 0,
      idle: 10000
    },
    dialectOptions: {
      charset: 'utf8mb4', // Set charset to utf8mb4
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
    if (process.env.NODE_ENV !== 'test') {
      process.exit(1); // Only exit if not in the test environment
    }
  });

module.exports = { sequelize };
