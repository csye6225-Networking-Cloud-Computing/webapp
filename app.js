const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const healthRoutes = require('./routes/health');
const userRoutes = require('./routes/user');
const { sequelize } = require('./config/database');
const StatsD = require('node-statsd');
const fs = require('fs');
const path = require('path');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// Initialize StatsD client
const client = new StatsD({ host: 'localhost', port: 8125 });

// Ensure logs directory and app.log file exist
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir);
}
const logFilePath = path.join(logsDir, 'app.log');
if (!fs.existsSync(logFilePath)) {
    fs.writeFileSync(logFilePath, ''); // Create an empty log file if it doesn't exist
}

// Setup logging to app.log
const logStream = fs.createWriteStream(logFilePath, { flags: 'a' });

// Middleware for request logging
app.use((req, res, next) => {
    const logMessage = `${new Date().toISOString()} - ${req.method} ${req.url}\n`;
    logStream.write(logMessage);
    console.log(logMessage); // Optional: also log to console
    next();
});

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
            client.increment('db.errors'); // Log database connection error to StatsD
            dbConnected = false;
        }
    }
};

// Check database connection on startup and at intervals
checkDatabaseConnection();
if (process.env.NODE_ENV !== 'test') {
    setInterval(checkDatabaseConnection, 2000); // Check every 2 seconds
}

// Add Sequelize sync (bootstrapping logic) to ensure schema is updated
sequelize.sync({ force: true })
    .then(() => {
        console.log('Database synchronized successfully');
    })
    .catch(err => {
        console.error('Detailed Error:', JSON.stringify(err, null, 2));
        client.increment('db.errors.sync'); // Log sync errors to StatsD
    });

// Middleware to handle database down (503 Service Unavailable) response
const checkDBStatusMiddleware = (req, res, next) => {
    if (!dbConnected) {
        return res.status(503).end(); // No message, just 503 Service Unavailable
    }
    next();
};

// Middleware for StatsD metrics tracking
app.use((req, res, next) => {
    const start = Date.now();
    
    res.on('finish', () => {
        const duration = Date.now() - start;
        const route = req.route ? req.route.path : req.path;

        // Increment a counter for each API endpoint
        client.increment(`api.calls.${route}.${req.method.toLowerCase()}`);

        // Log the response time as a timer
        client.timing(`api.response_time.${route}.${req.method.toLowerCase()}`, duration);
    });

    next();
});

// Middleware to handle JSON parsing errors gracefully
app.use(express.json());
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        console.error('Bad JSON Request:', err.message);
        client.increment('api.errors.json_parse'); // Log JSON parse errors to StatsD
        return res.status(400).end();
    }
    next();
});

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

// Handle unsupported methods (OPTIONS, HEAD, PATCH, PUT) explicitly for /v1/user/self/pic
const unsupportedMethodsForPic = ['OPTIONS', 'HEAD', 'PATCH', 'PUT'];

// For the /v1/user/self/pic route
unsupportedMethodsForPic.forEach((method) => {
    app[method.toLowerCase()]('/v1/user/self/pic', checkDBStatusMiddleware, (req, res) => {
        res.set('Allow', 'GET, POST, DELETE');  // Specify the allowed methods for /self/pic
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
