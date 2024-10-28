const AWS = require('aws-sdk');
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const healthRoutes = require('./routes/health');
const userRoutes = require('./routes/user');
const { sequelize } = require('./config/database');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

AWS.config.update({ region: process.env.AWS_REGION || 'us-east-1' });
const cloudwatch = new AWS.CloudWatch();

let dbConnected = false;
const isTestEnv = process.env.NODE_ENV === 'test';

// Utility function to log metrics (only active in non-test environments)
const logMetric = !isTestEnv
    ? (metricName, value, unit = 'Milliseconds') => {
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
            if (err) console.error(`Failed to push metric ${metricName}:`, err);
            else console.log(`Metric ${metricName} pushed successfully`);
        });
    }
    : () => {}; // No-op for test environment

// Middleware to track API response time
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        logMetric(`API-${req.method}-${req.path}`, duration);
    });
    next();
});

// Database connection check
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

checkDatabaseConnection();
if (!isTestEnv) {
    setInterval(checkDatabaseConnection, 2000);
}

// Add Sequelize sync (bootstrapping logic) to ensure schema is updated
sequelize.sync({ force: true })
    .then(() => {
        console.log('Database synchronized successfully');
    })
    .catch(err => {
        console.error('Detailed Error:', JSON.stringify(err, null, 2));
    });

// Middleware to handle database down (503 Service Unavailable) response
const checkDBStatusMiddleware = (req, res, next) => {
    if (!dbConnected) {
        return res.status(503).end();
    }
    next();
};

// Handle unsupported methods for routes
const unsupportedMethodsForPic = ['OPTIONS', 'HEAD', 'PATCH', 'PUT'];
unsupportedMethodsForPic.forEach((method) => {
    app[method.toLowerCase()]('/v1/user/self/pic', checkDBStatusMiddleware, (req, res) => {
        res.set('Allow', 'GET, POST, DELETE');
        return res.status(405).end();
    });
});

app.use(cors());
app.use(express.json());
app.use('/healthz', checkDBStatusMiddleware, healthRoutes);
app.use('/v1/user', checkDBStatusMiddleware, userRoutes);

app.use((req, res) => res.status(404).end());

module.exports = app;

if (!isTestEnv) {
    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });
}
