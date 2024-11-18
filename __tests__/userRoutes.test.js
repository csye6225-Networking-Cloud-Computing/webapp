const request = require('supertest');
const app = require('../app');
const { sequelize } = require('../config/database');
const User = require('../models/user');

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
                Location: 'https://mock-bucket.s3.amazonaws.com/mock-key',
            }),
        }),
        deleteObject: jest.fn().mockReturnValue({
            promise: jest.fn().mockResolvedValue({}),
        }),
    };
    return {
        config: { update: jest.fn() },
        SNS: jest.fn(() => mockSNS),
        CloudWatch: jest.fn(() => mockCloudWatch),
        S3: jest.fn(() => mockS3),
    };
});

// Mock StatsD
jest.mock('node-statsd', () => {
    return jest.fn().mockImplementation(() => ({
        timing: jest.fn(),
        increment: jest.fn(),
    }));
});

// Helper function to generate Basic Auth headers
const generateAuthHeader = (email, password) => {
    const credentials = Buffer.from(`${email}:${password}`).toString('base64');
    return `Basic ${credentials}`;
};

// Clear mocks after each test
afterEach(() => {
    jest.clearAllMocks();
});

// Close Sequelize connection after all tests
afterAll(async () => {
    await sequelize.close();
});

describe('User Routes', () => {
    it('should create a new user', async () => {
        const res = await request(app)
            .post('/v1/users')
            .send({
                first_name: 'John',
                last_name: 'Doe',
                email: 'john.doe@example.com',
                password: 'password123',
            });
        expect(res.statusCode).toEqual(201);
        expect(res.body).toHaveProperty('email', 'john.doe@example.com');
    });

    it('should return the authenticated user’s information', async () => {
        const user = await User.create({
            first_name: 'John',
            last_name: 'Doe',
            email: 'john.doe@example.com',
            password: 'password123',
            verified: true,
        });

        const authHeader = generateAuthHeader(user.email, 'password123');

        const res = await request(app)
            .get('/v1/users/self')
            .set('Authorization', authHeader);

        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('email', user.email);
    });

    it('should update the authenticated user’s information', async () => {
        const user = await User.create({
            first_name: 'John',
            last_name: 'Doe',
            email: 'john.doe@example.com',
            password: 'password123',
            verified: true,
        });

        const authHeader = generateAuthHeader(user.email, 'password123');

        const res = await request(app)
            .put('/v1/users/self')
            .set('Authorization', authHeader)
            .send({
                first_name: 'Johnny',
                last_name: 'Doe',
                password: 'newpassword123',
            });

        expect(res.statusCode).toEqual(204);
    });

    it('should not allow updates to restricted fields like email or account_created', async () => {
        const user = await User.create({
            first_name: 'John',
            last_name: 'Doe',
            email: 'john.doe@example.com',
            password: 'password123',
            verified: true,
        });

        const authHeader = generateAuthHeader(user.email, 'password123');

        const res = await request(app)
            .put('/v1/users/self')
            .set('Authorization', authHeader)
            .send({
                email: 'newemail@example.com', // Attempt to update restricted field
            });

        expect(res.statusCode).toEqual(400);
    });
});
