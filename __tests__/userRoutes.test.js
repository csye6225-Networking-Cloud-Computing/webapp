const request = require('supertest');
const app = require('../app'); // Import your Express app
const { sequelize } = require('../config/database'); // Import Sequelize instance
const User = require('../models/user'); // Import User model explicitly
const ProfilePicture = require('../models/profilePicture.js'); // Import ProfilePicture model explicitly

// Mock AWS SDK
jest.mock('aws-sdk', () => {
    const mockSNS = {
        publish: jest.fn().mockReturnValue({
            promise: jest.fn().mockResolvedValue({}),
        }),
    };
    const mockCloudWatch = {
        putMetricData: jest.fn().mockReturnValue({
            promise: jest.fn().mockResolvedValue({}),
        }),
    };
    const mockS3 = {
        upload: jest.fn().mockReturnValue({
            promise: jest.fn().mockResolvedValue({
                Location: 'https://mock-s3-url/test-image.jpg',
            }),
        }),
        deleteObject: jest.fn().mockReturnValue({
            promise: jest.fn().mockResolvedValue({}),
        }),
    };
    return {
        SNS: jest.fn(() => mockSNS),
        CloudWatch: jest.fn(() => mockCloudWatch),
        S3: jest.fn(() => mockS3),
    };
});

// Mock node-statsd
jest.mock('node-statsd', () => {
    return jest.fn().mockImplementation(() => ({
        timing: jest.fn(),
        increment: jest.fn(),
        close: jest.fn(),
    }));
});

// Set environment variables for tests
process.env.AWS_REGION = 'us-east-1';
process.env.S3_BUCKET_NAME = 'test-bucket';
process.env.SNS_TOPIC_ARN = 'arn:aws:sns:us-east-1:123456789012:mock-topic';

// Helper function for Basic Auth headers
const generateAuthHeader = (email, password) => {
    const credentials = Buffer.from(`${email}:${password}`).toString('base64');
    return `Basic ${credentials}`;
};

// Sync database before each test
beforeEach(async () => {
    await sequelize.sync({ force: true });
});

// Close database connections after all tests
afterAll(async () => {
    await sequelize.close();
});

describe('User Routes', () => {
    it('should create a new user', async () => {
        const res = await request(app)
            .post('/v1/user')
            .send({
                first_name: 'John',
                last_name: 'Doe',
                email: 'john.doe@example.com',
                password: 'Password123!',
            });

        expect(res.statusCode).toEqual(201);
        expect(res.body).toHaveProperty('id'); // Check for user ID
    });

    it('should not create a user with an existing email', async () => {
        await request(app)
            .post('/v1/user')
            .send({
                first_name: 'John',
                last_name: 'Doe',
                email: 'john.doe@example.com',
                password: 'Password123!',
            });

        const res = await request(app)
            .post('/v1/user')
            .send({
                first_name: 'Jane',
                last_name: 'Doe',
                email: 'john.doe@example.com',
                password: 'Password123!',
            });

        expect(res.statusCode).toEqual(400);
    });

    it('should return the authenticated user’s information', async () => {
        // Create and authenticate user
        await request(app)
            .post('/v1/user')
            .send({
                first_name: 'John',
                last_name: 'Doe',
                email: 'john.doe@example.com',
                password: 'Password123!',
            });

        const authHeader = generateAuthHeader('john.doe@example.com', 'Password123!');

        const res = await request(app)
            .get('/v1/user/self')
            .set('Authorization', authHeader);

        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('first_name', 'John');
    });

    it('should update the authenticated user’s information', async () => {
        // Create and authenticate user
        await request(app)
            .post('/v1/user')
            .send({
                first_name: 'John',
                last_name: 'Doe',
                email: 'john.doe@example.com',
                password: 'Password123!',
            });

        const authHeader = generateAuthHeader('john.doe@example.com', 'Password123!');

        const res = await request(app)
            .put('/v1/user/self')
            .set('Authorization', authHeader)
            .send({
                first_name: 'Johnny',
                last_name: 'Doey',
                password: 'NewPassword123!',
            });

        expect(res.statusCode).toEqual(204);
    });

    it('should not allow updates to restricted fields', async () => {
        await request(app)
            .post('/v1/user')
            .send({
                first_name: 'John',
                last_name: 'Doe',
                email: 'john.doe@example.com',
                password: 'Password123!',
            });

        const authHeader = generateAuthHeader('john.doe@example.com', 'Password123!');

        const res = await request(app)
            .put('/v1/user/self')
            .set('Authorization', authHeader)
            .send({ email: 'newemail@example.com' });

        expect(res.statusCode).toEqual(400);
    });

    it('should upload a profile picture for the authenticated user', async () => {
        // Create and authenticate user
        await request(app)
            .post('/v1/user')
            .send({
                first_name: 'John',
                last_name: 'Doe',
                email: 'john.doe@example.com',
                password: 'Password123!',
            });

        const authHeader = generateAuthHeader('john.doe@example.com', 'Password123!');

        const res = await request(app)
            .post('/v1/user/self/pic')
            .set('Authorization', authHeader)
            .attach('profilePic', Buffer.from('mock-image'), 'test.jpg');

        expect(res.statusCode).toEqual(201);
    });
});
