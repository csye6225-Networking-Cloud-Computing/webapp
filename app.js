const AWS = require('aws-sdk');
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const healthRoutes = require('./routes/health');
const userRoutes = require('./routes/user');
const { sequelize } = require('./config/database');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// Set up CloudWatch and region configuration
AWS.config.update({ region: process.env.AWS_REGION || 'us-east-1' });
const cloudwatch = new AWS.CloudWatch();

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
const logToFile = (message) => {
    const logMessage = `${new Date().toISOString()} - ${message}\n`;
    logStream.write(logMessage);
    console.log(logMessage); // Optional: also log to console
};

// Utility function to log metrics (only active in non-test environments)
const logMetric = (metricName, value, unit = 'Milliseconds') => {
    if (process.env.NODE_ENV === 'test') return;

    const params = {
        MetricData: [
            {
                MetricName: metricName,
                Dimensions: [{ Name: 'InstanceId', Value: process.env.INSTANCE_ID || 'localhost' }],
                Unit: unit,
                Value: value
            }
        ],
        Namespace: 'WebAppMetrics'
    };
    cloudwatch.putMetricData(params, (err) => {
        if (err) logToFile(`Failed to push metric ${metricName}: ${err}`);
        else logToFile(`Metric ${metricName} pushed successfully`);
    });
};

// Middleware to track API response time and log to CloudWatch
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        logMetric(`API-${req.method}-${req.path}`, duration);
        logToFile(`Request to ${req.method} ${req.path} took ${duration} ms`);
    });
    next();
});

let dbConnected = false;

// Function to check database connection and log status
const checkDatabaseConnection = async () => {
    try {
        await sequelize.authenticate();
        if (!dbConnected) {
            logToFile('Database connected...');
            dbConnected = true;
        }
    } catch (error) {
        if (dbConnected) {
            logToFile(`Unable to connect to the database: ${error.message}`);
            dbConnected = false;
        }
    }
};

// Check database connection on startup and at intervals
checkDatabaseConnection();
if (process.env.NODE_ENV !== 'test') {
    setInterval(checkDatabaseConnection, 2000); // Check every 2 seconds
}

// Sync Sequelize schema and log errors to CloudWatch
sequelize.sync({ force: true })
    .then(() => logToFile('Database synchronized successfully'))
    .catch(err => {
        logToFile(`Detailed Error: ${JSON.stringify(err, null, 2)}`);
        logMetric('DBSyncError', 1, 'Count');
    });

// Middleware to handle database down (503 Service Unavailable) response
const checkDBStatusMiddleware = (req, res, next) => {
    if (!dbConnected) {
        return res.status(503).end();
    }
    next();
};

// Middleware to handle JSON parsing errors gracefully
app.use(express.json());
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        logToFile(`Bad JSON Request: ${err.message}`);
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
    logToFile(`404 - Not Found: ${req.method} ${req.path}`);
    res.status(404).end();  // Send 404 status with no body
});

// Export app for testing
module.exports = app;

// Start the server if not in test environment
if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => {
        logToFile(`Server is running on http://localhost:${PORT}`);
    });
}
