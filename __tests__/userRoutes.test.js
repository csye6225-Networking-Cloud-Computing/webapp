const request = require('supertest');
const app = require('../app'); // Adjust path to your main app file
const { sequelize } = require('../config/database');

describe('Healthz Route Integration Tests', () => {
  beforeAll(async () => {
    // Ensure database connection before tests
    await sequelize.authenticate();
  });

  afterAll(async () => {
    // Close database connection after tests
    await sequelize.close();
  });

  test('GET /healthz should return 200 OK when database is connected', async () => {
    const response = await request(app).get('/healthz');
    
    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-cache, no-store, must-revalidate');
    expect(response.headers['pragma']).toBe('no-cache');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });

  test('Unsupported HTTP methods on /healthz should return 405', async () => {
    const unsupportedMethods = ['post', 'put', 'delete', 'patch', 'head', 'options'];
    
    for (const method of unsupportedMethods) {
      const response = await request(app)[method]('/healthz');
      
      expect(response.status).toBe(405);
      expect(response.headers['allow']).toBe('GET');
    }
  });

  test('GET /healthz should return 503 if database is not connected', async () => {
    // Mock database authentication to simulate connection failure
    const originalAuthenticate = sequelize.authenticate;
    sequelize.authenticate = jest.fn().mockRejectedValue(new Error('Database connection failed'));

    const response = await request(app).get('/healthz');
    
    expect(response.status).toBe(503);

    // Restore original authenticate method
    sequelize.authenticate = originalAuthenticate;
  });
});