const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { sequelize } = require('./config/database');
const healthRoutes = require('./routes/health');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// Enable CORS for all routes
app.use(cors());

// Test database connection
sequelize.authenticate()
    .then(() => console.log('Database connected...'))
    .catch(err => console.error('Unable to connect to the database:', err));

// Health check endpoint
app.use('/healthz', healthRoutes);

// Explicitly handle HEAD requests by returning 405
app.head('/healthz', (req, res) => {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    return res.status(405).send(); // 405 Method Not Allowed
});

// Explicitly handle OPTIONS requests by returning 405
app.options('*', (req, res) => {
    res.status(405).end(); // Send 405 with no body
});

// Handle all other routes and methods (GET, POST, etc.)
app.all('*', (req, res) => {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');

    if (req.method === 'GET') {
        // Return 200 OK for GET requests
        return res.status(200).send();
    }

    // Return 405 Method Not Allowed for any unsupported methods
    res.status(405).end(); // No message body for 405
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
