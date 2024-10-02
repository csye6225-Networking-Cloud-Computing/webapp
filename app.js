const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const healthRoutes = require('./routes/health');
const userRoutes = require('./routes/user');
const { sequelize } = require('./config/database'); // Importing the database configuration

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

let dbConnected = false; // Track the database connection status

// Function to check database connection and log status
const checkDatabaseConnection = async () => {
    try {
        await sequelize.authenticate();
        if (!dbConnected) {
            console.log('Database connected...');
            dbConnected = true;
        }
    } catch (error) {
        if (dbConnected) {
            console.error('Unable to connect to the database:', error.message);
            dbConnected = false;
        }
    }
};

// Check database connection on startup and at intervals
checkDatabaseConnection();
setInterval(checkDatabaseConnection, 2000); // Check every 2 seconds

// Add Sequelize sync (bootstrapping logic) to ensure schema is updated
sequelize.sync({ alter: true }) // Use { force: true } if you want to drop tables and recreate
    .then(() => {
        console.log('Database synchronized successfully');
    })
    .catch(err => {
        console.error('Error synchronizing database:', err);
    });

// Middleware to handle database down (503 Service Unavailable) response
const checkDBStatusMiddleware = (req, res, next) => {
    if (!dbConnected) {
        return res.status(503).end(); // No message, just 503 Service Unavailable
    }
    next();
};

// Middleware to parse JSON bodies
app.use(express.json());

// Handle unsupported methods (OPTIONS, HEAD) explicitly before CORS
const unsupportedMethods = ['OPTIONS', 'HEAD'];

// For the /v1/users/self route
unsupportedMethods.forEach((method) => {
    app[method.toLowerCase()]('/v1/user/self', checkDBStatusMiddleware, (req, res) => {
        res.set('Allow', 'GET, PUT');  // Specify the allowed methods for preflight
        return res.status(405).end();  // Return 405 Method Not Allowed
    });
});

// For the /healthz route
unsupportedMethods.forEach((method) => {
    app[method.toLowerCase()]('/healthz', checkDBStatusMiddleware, (req, res) => {
        res.set('Allow', 'GET');  // Specify the allowed method for healthz
        return res.status(405).end();  // Return 405 Method Not Allowed
    });
});

// Enable CORS for all routes after OPTIONS/HEAD handling
app.use(cors());

// Define routes and add database status middleware
app.use('/healthz', checkDBStatusMiddleware, healthRoutes);
app.use('/v1/user', checkDBStatusMiddleware, userRoutes);

// Add a 404 handler for undefined routes
app.use((req, res) => {
    return res.status(404).end();  // Send 404 status with no body
});

// Export the app for testing purposes
module.exports = app;

// Start the server only if not testing
if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });
}
