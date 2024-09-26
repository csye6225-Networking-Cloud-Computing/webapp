const express = require('express');
const dotenv = require('dotenv');
const { sequelize } = require('./config/database');
const healthRoutes = require('./routes/health');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

let dbConnected = false; //Track the database connection status

//Function to check database connection and log status
const checkDatabaseConnection = async () => {
    try {
        await sequelize.authenticate();
        if (!dbConnected) {
            console.log('Database connected.');
            dbConnected = true;
        }
    } catch (error) {
        if (dbConnected) {
            console.error('Unable to connect to the database -', error.message);
            dbConnected = false;
        }
    }
};

//Check database connection on startup
checkDatabaseConnection();
setInterval(checkDatabaseConnection, 10000);

//Middleware to handle health check requests
const handleHealthCheck = async (req, res) => {
    try {
        await sequelize.authenticate();
        res.set({
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
        });
        return res.status(405).end(); //405 Method Not Allowed
    } catch (error) {
        res.set({
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
        });
        return res.status(503).send(); //Send 503 if the DB is down
    }
};

//Handle HEAD and OPTIONS requests for health check
app.head('/healthz', handleHealthCheck);
app.options('/healthz', handleHealthCheck);

//Enable CORS for all routes
const cors = require('cors');
app.use(cors());

//Check database connection for all requests
app.use(async (req, res, next) => {
    try {
        await sequelize.authenticate();
        next(); //Proceed to the next route handler if DB is connected
    } catch (error) {
        res.set({
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache' 
        });
        return res.status(503).send(); //Send 503 if the DB is down
    }
});

//Health check endpoint for GET requests
app.use('/healthz', healthRoutes);

//Handle all other routes and methods
app.all('/healthz', (req, res) => {
    res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
    });
    res.status(405).end(); // 405 Method Not Allowed
});

//Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
