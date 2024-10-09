const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');

dotenv.config();

const dbPassword = process.env.DB_PASSWORD === 'EMPTY_PASSWORD' ? '' : process.env.DB_PASSWORD;

const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, dbPassword, {
    host: process.env.DB_HOST,
    dialect: 'mysql',
    port: process.env.DB_PORT,
    logging: console.log, // Enable logging to see SQL queries
    pool: {
        max: 10,
        min: 0,
        idle: 10000
    }
});

// Test the connection
sequelize.authenticate()
    .then(() => console.log('Database connection has been established successfully.'))
    .catch(err => console.error('Unable to connect to the database:', err));

module.exports = { sequelize };