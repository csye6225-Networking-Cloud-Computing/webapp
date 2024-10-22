const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

// Set default environment to development if not specified
const environment = process.env.NODE_ENV || 'development';
console.log(`Running in environment: ${environment}`);

// Initialize Sequelize instance with a default value
let sequelize = null;

// Skip the database connection if SKIP_DB is set or if running in ami_build environment
if (process.env.SKIP_DB || environment === 'ami_build') {
  console.log('Skipping database connection.');
} else {
  // Proceed with normal database connection for other environments
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

  // Initialize Sequelize instance with MySQL connection
  sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD, // Use the actual password here
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
}

module.exports = { sequelize };
