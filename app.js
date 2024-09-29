const express = require('express');
const dotenv = require('dotenv');
const { sequelize } = require('./config/database');
const healthRoutes = require('./routes/health');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

let dbConnected = false;

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
            console.error('Unable to connect to the database -', error.message);
            dbConnected = false;
        }
    }
};

// Check database connection on startup
checkDatabaseConnection();
setInterval(checkDatabaseConnection, 10000); // Check every 10 seconds

// Middleware to handle health check requests
const handleHealthCheck = async (req, res) => {
    try {
        await sequelize.authenticate();
        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        return res.status(405).end(); // 405 Method Not Allowed
    } catch (error) {
        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        return res.status(503).send();
    }
};

// Handle HEAD and OPTIONS requests for health check
app.head('/healthz', handleHealthCheck);
app.options('/healthz', handleHealthCheck);

// Enable CORS
const cors = require('cors');
app.use(cors());

// Check database connection for all requests
app.use(async (req, res, next) => {
    try {
        await sequelize.authenticate();
        next();
    } catch (error) {
        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        return res.status(503).send();
    }
});

// Health check endpoint
app.use('/healthz', healthRoutes);

// Handle other methods for /healthz
app.all('/healthz', (req, res) => {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.status(405).end();
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

// --- User API Code ---

const userRoutes = require('./routes/user');

// Middleware to parse JSON bodies
app.use(express.json());

// Sync the database schema
sequelize.sync({ alter: false })
  .then(() => {
    console.log('Database synced successfully');
  })
  .catch((err) => {
    console.error('Failed to sync database:', err);
  });

// User Routes
app.use('/api/users', userRoutes);
