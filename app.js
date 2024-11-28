const AWS = require('aws-sdk');
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const StatsD = require('node-statsd');
const axios = require('axios');
const healthRoutes = require('./routes/health');
const userRoutes = require('./routes/user');
const { sequelize } = require('./config/database');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// Set up CloudWatch and region configuration
AWS.config.update({ region: process.env.AWS_REGION || 'us-east-1' });
const cloudwatch = new AWS.CloudWatch();

// Initialize StatsD client only if not in test environment
let statsdClient;
if (process.env.NODE_ENV !== 'test') {
    statsdClient = new StatsD({ host: 'localhost', port: 8125 });
} else {
    // No-op function for StatsD in test environment
    statsdClient = { timing: () => {}, increment: () => {} };
}

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

// Initialize instance metadata token and ID
let metadataToken = null;
let tokenExpirationTime = null;
let instanceId = 'localhost';

// Function to refresh the metadata token if needed
async function getMetadataToken() {
    const currentTime = Date.now();
    if (metadataToken && currentTime < tokenExpirationTime) {
        return metadataToken;
    }

    try {
        const response = await axios.put(
            'http://169.254.169.254/latest/api/token',
            null,
            { headers: { 'X-aws-ec2-metadata-token-ttl-seconds': '21600' } }
        );
        metadataToken = response.data;
        tokenExpirationTime = currentTime + 21600 * 1000;
        return metadataToken;
    } catch (error) {
        console.warn("Could not retrieve IMDSv2 token. Using 'localhost' as Instance ID.");
        return null;
    }
}

// Function to retrieve the instance ID using IMDSv2
async function fetchInstanceId() {
    try {
        const token = await getMetadataToken();
        if (!token) return;

        const instanceResponse = await axios.get(
            'http://169.254.169.254/latest/meta-data/instance-id',
            { headers: { 'X-aws-ec2-metadata-token': token } }
        );
        instanceId = instanceResponse.data;
        logToFile(`Fetched Instance ID: ${instanceId}`);
    } catch (error) {
        console.warn("Could not retrieve Instance ID. Using 'localhost' as fallback.");
    }
}

// Fetch instance ID at startup
fetchInstanceId();

// Utility function to log CloudWatch metrics
const logMetric = (metricName, value, unit = 'Milliseconds') => {
    if (process.env.NODE_ENV === 'test') return;

    const params = {
        MetricData: [
            {
                MetricName: metricName,
                Dimensions: [{ Name: 'InstanceId', Value: instanceId }],
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

// Middleware to track API response time and log to CloudWatch and StatsD
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        logMetric(`API-${req.method}-${req.path}`, duration);
        statsdClient.timing(`api.${req.method.toLowerCase()}.${req.path.replace(/\//g, '_')}`, duration);
        logToFile(`Request to ${req.method} ${req.path} took ${duration} ms`);
    });
    next();
});

let dbConnected = false;

// Function to check database connection and log status
const checkDatabaseConnection = async () => {
    try {
        const start = Date.now();
        await sequelize.authenticate();
        const dbDuration = Date.now() - start;
        logMetric('DBConnectionTime', dbDuration);
        statsdClient.timing('db.connection.time', dbDuration);

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
sequelize.sync({ alter: true })
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
const unsupportedMethods = ['OPTIONS', 'HEAD', 'DELETE', 'PATCH'];

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
//app.use('/cicd', checkDBStatusMiddleware, healthRoutes);
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