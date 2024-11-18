// __tests__/healthCheck.test.js

// 1. Mock node-statsd to prevent open handles and network calls
jest.mock('node-statsd', () => {
  return jest.fn().mockImplementation(() => ({
      timing: jest.fn(),
      increment: jest.fn(),
      close: jest.fn(),
  }));
});

// 2. Import sequelize and set up the spy BEFORE requiring the app
const { sequelize } = require('../config/database');
jest.spyOn(sequelize, 'authenticate');

// 3. Now, require the Express app after mocking
const app = require('../app');
const request = require('supertest');

describe('Health Check API Integration Tests for /healthzzz', () => {
  // Reset mocks before each test to ensure isolation
  beforeEach(() => {
      sequelize.authenticate.mockReset();
  });

  // Restore mocks and close connections after all tests
  afterAll(async () => {
      sequelize.authenticate.mockRestore();
      await sequelize.close();
  });

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
