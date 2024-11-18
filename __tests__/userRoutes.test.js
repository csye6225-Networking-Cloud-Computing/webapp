const AWSMock = require('aws-sdk-mock');
const AWS = require('aws-sdk');
const request = require('supertest');
const app = require('../app');
const { sequelize } = require('../config/database');
const User = require('../models/user');

beforeAll(() => {
    // Mock S3 methods
    AWSMock.mock('S3', 'upload', (params, callback) => {
        callback(null, { Location: 'mocked-url' });
    });
    AWSMock.mock('S3', 'getObject', (params, callback) => {
        callback(null, { Body: 'mocked-body' });
    });

    // Mock SNS publish
    AWSMock.mock('SNS', 'publish', (params, callback) => {
        callback(null, { MessageId: 'mocked-message-id' });
    });

    // Mock CloudWatch putMetricData
    AWSMock.mock('CloudWatch', 'putMetricData', (params, callback) => {
        callback(null, {});
    });

    // Mock other AWS services if used
});

afterEach(() => {
    AWSMock.restore(); // Restore all mocks after each test
    jest.clearAllMocks();
});

afterAll(async () => {
    await sequelize.close();
});

describe('User Routes', () => {
    beforeEach(async () => {
        await sequelize.sync({ force: true }); // Reset database before each test
    });

    it('should create a new user', async () => {
        const res = await request(app)
            .post('/v1/user')
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
            firstName: 'John',
            lastName: 'Doe',
            email: 'john.doe@example.com',
            password: 'password123',
            verified: true,
        });

        const authHeader = `Basic ${Buffer.from('john.doe@example.com:password123').toString('base64')}`;

        const res = await request(app)
            .get('/v1/user/self')
            .set('Authorization', authHeader);

        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('email', user.email);
    });

    it('should update the authenticated user’s information', async () => {
        const user = await User.create({
            firstName: 'John',
            lastName: 'Doe',
            email: 'john.doe@example.com',
            password: 'password123',
            verified: true,
        });

        const authHeader = `Basic ${Buffer.from('john.doe@example.com:password123').toString('base64')}`;

        const res = await request(app)
            .put('/v1/user/self')
            .set('Authorization', authHeader)
            .send({
                first_name: 'Johnny',
                last_name: 'Smith',
                password: 'newpassword123',
            });

        expect(res.statusCode).toEqual(204);
    });

    it('should not allow updates to restricted fields like email or account_created', async () => {
        const user = await User.create({
            firstName: 'John',
            lastName: 'Doe',
            email: 'john.doe@example.com',
            password: 'password123',
            verified: true,
        });

        const authHeader = `Basic ${Buffer.from('john.doe@example.com:password123').toString('base64')}`;

        const res = await request(app)
            .put('/v1/user/self')
            .set('Authorization', authHeader)
            .send({
                email: 'newemail@example.com', // Attempt to update restricted field
            });

        expect(res.statusCode).toEqual(400);
    });
});
