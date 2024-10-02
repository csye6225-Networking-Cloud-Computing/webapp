// __tests__/userRoutes.test.js

const request = require('supertest');
const app = require('../app');  // Import the app
const { sequelize } = require('../config/database');  // Import the Sequelize instance for DB handling

beforeAll(async () => {
  // Ensure the database is connected and synced for testing
  await sequelize.authenticate();
  await sequelize.sync({ force: true }); // Recreate the schema for testing
});

afterAll(async () => {
  // Close the database connection after the tests
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
        password: 'password123',
      });
    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('email', 'john.doe@example.com');
  });

  it('should not create a user with an existing email', async () => {
    // First, create a user
    await request(app)
      .post('/v1/user')
      .send({
        first_name: 'John',
        last_name: 'Doe',
        email: 'john.doe@example.com',
        password: 'password123',
      });

    // Then, attempt to create another user with the same email
    const res = await request(app)
      .post('/v1/user')
      .send({
        first_name: 'John',
        last_name: 'Doe',
        email: 'john.doe@example.com',
        password: 'password123',
      });
    expect(res.statusCode).toEqual(400); // 400 for email conflict
  });

  it('should return the authenticated user’s information', async () => {
    const credentials = Buffer.from('john.doe@example.com:password123').toString('base64');
    
    const res = await request(app)
      .get('/v1/user/self')
      .set('Authorization', `Basic ${credentials}`);  // Set Basic Auth with encoded credentials

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('email');
});

  // Add more tests for other routes like PUT, GET, etc.
});
