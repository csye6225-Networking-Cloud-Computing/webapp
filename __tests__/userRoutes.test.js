// __tests__/healthCheck.test.js
const request = require('supertest');
const app = require('../app'); // Adjust the path if necessary
const { sequelize } = require('../config/database');

// Spy on sequelize.authenticate before all tests
beforeAll(() => {
    jest.spyOn(sequelize, 'authenticate');
});

// Reset mocks before each test to ensure isolation
beforeEach(() => {
    sequelize.authenticate.mockReset();
});

afterAll(async () => {
    // Restore the original implementation of authenticate
    sequelize.authenticate.mockRestore();
    // Close the Sequelize connection after all tests
    await sequelize.close();
});

describe('Health Check API Integration Tests for /healthzzz', () => {
    describe('GET /healthzzz', () => {
        it('should return 200 OK when DB connection is successful', async () => {
            // Mock authenticate to resolve successfully
            sequelize.authenticate.mockResolvedValue();

            const res = await request(app).get('/healthzzz');

            expect(sequelize.authenticate).toHaveBeenCalledTimes(1);
            expect(res.statusCode).toBe(200);
            expect(res.headers['cache-control']).toBe('no-cache, no-store, must-revalidate');
            expect(res.headers['pragma']).toBe('no-cache');
            expect(res.headers['x-content-type-options']).toBe('nosniff');
        });

        it('should return 503 Service Unavailable when DB connection fails', async () => {
            // Mock authenticate to reject with an error
            sequelize.authenticate.mockRejectedValue(new Error('DB Connection Failed'));

            const res = await request(app).get('/healthzzz');

            expect(sequelize.authenticate).toHaveBeenCalledTimes(1);
            expect(res.statusCode).toBe(503);
            expect(res.headers['cache-control']).toBe('no-cache, no-store, must-revalidate');
            expect(res.headers['pragma']).toBe('no-cache');
        });
    });

    describe('Unsupported Methods on /healthzzz', () => {
        const unsupportedMethods = ['POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'];

        unsupportedMethods.forEach((method) => {
            it(`should return 405 Method Not Allowed for ${method} /healthzzz`, async () => {
                const res = await request(app)[method.toLowerCase()]('/healthzzz');

                expect(res.statusCode).toBe(405);
                expect(res.headers['allow']).toBe('GET');
            });
        });
    });
});
