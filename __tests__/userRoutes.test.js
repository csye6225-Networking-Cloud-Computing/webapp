// __tests__/healthCheck.test.js
const request = require('supertest');
const app = require('../app'); // Adjust the path if necessary
const { sequelize } = require('../config/database');

// Mock sequelize.authenticate()
jest.mock('../config/database', () => {
    const originalModule = jest.requireActual('../config/database');
    return {
        ...originalModule,
        sequelize: {
            ...originalModule.sequelize,
            authenticate: jest.fn(),
        },
    };
});

describe('Health Check API Integration Tests', () => {
    afterAll(async () => {
        // Close the Sequelize connection after all tests
        await sequelize.close();
    });

    describe('GET /health', () => {
        it('should return 200 OK when DB connection is successful', async () => {
            // Mock authenticate to resolve successfully
            sequelize.authenticate.mockResolvedValue();

            const res = await request(app).get('/health');

            expect(res.statusCode).toBe(200);
            expect(res.headers['cache-control']).toBe('no-cache, no-store, must-revalidate');
            expect(res.headers['pragma']).toBe('no-cache');
            expect(res.headers['x-content-type-options']).toBe('nosniff');
        });

        it('should return 503 Service Unavailable when DB connection fails', async () => {
            // Mock authenticate to reject with an error
            sequelize.authenticate.mockRejectedValue(new Error('DB Connection Failed'));

            const res = await request(app).get('/health');

            expect(res.statusCode).toBe(503);
            expect(res.headers['cache-control']).toBe('no-cache, no-store, must-revalidate');
        });
    });

    describe('Unsupported Methods on /health', () => {
        const unsupportedMethods = ['POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'];

        unsupportedMethods.forEach((method) => {
            it(`should return 405 Method Not Allowed for ${method} /health`, async () => {
                const res = await request(app)[method.toLowerCase()]('/health');

                expect(res.statusCode).toBe(405);
                expect(res.headers['allow']).toBe('GET');
            });
        });
    });
});
