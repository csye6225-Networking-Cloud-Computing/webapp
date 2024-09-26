const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');

//Load environment variables from .env file
dotenv.config();

//Initialize Sequelize
const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST,
        logging: false, 
        dialect: 'mysql', // Using MySQL as the dialect
        pool: {
            max: 10, 
            min: 0, 
            idle: 10000 
        }
    }
);

module.exports = { sequelize };
