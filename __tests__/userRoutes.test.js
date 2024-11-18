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
    return {
        SNS: jest.fn(() => mockSNS),
        CloudWatch: jest.fn(() => mockCloudWatch),
        config: { update: jest.fn() },
    };
});

beforeEach(async () => {
    await sequelize.sync({ force: true }); // Reset database before each test
});

afterEach(() => {
    jest.clearAllMocks(); // Clear mocks after each test
});

afterAll(async () => {
    await sequelize.close(); // Close Sequelize connection after all tests
});

describe('User Routes', () => {
    it('should create a new user', async () => {
        const res = await request(app)
            .post('/v1/user') // Corrected endpoint
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
            .get('/v1/user/self') // Corrected endpoint
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
            .put('/v1/user/self') // Corrected endpoint
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
            .put('/v1/user/self') // Corrected endpoint
            .set('Authorization', authHeader)
            .send({
                email: 'newemail@example.com', // Attempt to update restricted field
            });

        expect(res.statusCode).toEqual(400);
    });
});
