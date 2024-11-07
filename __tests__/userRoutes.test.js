const request = require('supertest');
const app = require('../app');
const { sequelize } = require('../config/database');
const User = require('../models/user');
const Image = require('../models/profilePicture');
const { statsdClient } = require('../routes/user');

jest.mock('node-statsd', () => {
  return jest.fn().mockImplementation(() => ({
    timing: jest.fn(),
    increment: jest.fn(),
    close: jest.fn(),
  }));
});

// Helper function to generate Basic Auth headers
const generateAuthHeader = (email, password) => {
  const credentials = Buffer.from(`${email}:${password}`).toString('base64');
  return `Basic ${credentials}`;
};

// Sync database before all tests
beforeAll(async () => {
  await sequelize.sync({ force: true });
});

afterAll(async () => {
  await sequelize.close();
  if (statsdClient && typeof statsdClient.close === 'function') {
    statsdClient.close();
  }
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
    await request(app)
      .post('/v1/user')
      .send({
        first_name: 'John',
        last_name: 'Doe',
        email: 'john.doe@example.com',
        password: 'password123',
      });

    const res = await request(app)
      .post('/v1/user')
      .send({
        first_name: 'John',
        last_name: 'Doe',
        email: 'john.doe@example.com',
        password: 'password123',
      });
    expect(res.statusCode).toEqual(400);
  });

  it('should return the authenticated user’s information', async () => {
    await request(app)
      .post('/v1/user')
      .send({
        first_name: 'John',
        last_name: 'Doe',
        email: 'john.doe@example.com',
        password: 'password123',
      });

    const authHeader = generateAuthHeader('john.doe@example.com', 'password123');

    const res = await request(app)
      .get('/v1/user/self')
      .set('Authorization', authHeader);

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('email', 'john.doe@example.com');
  });

  it('should update the authenticated user’s information', async () => {
    await request(app)
      .post('/v1/user')
      .send({
        first_name: 'John',
        last_name: 'Doe',
        email: 'john.doe@example.com',
        password: 'password123',
      });

    const authHeader = generateAuthHeader('john.doe@example.com', 'password123');

    const res = await request(app)
      .put('/v1/user/self')
      .set('Authorization', authHeader)
      .send({
        first_name: 'Johnny',
        last_name: 'Doe',
        password: 'newpassword123',
      });

    expect(res.statusCode).toEqual(204);
  });

  it('should not allow updates to restricted fields like email or account_created', async () => {
    await request(app)
      .post('/v1/user')
      .send({
        first_name: 'John',
        last_name: 'Doe',
        email: 'john.doe@example.com',
        password: 'password123',
      });

    const authHeader = generateAuthHeader('john.doe@example.com', 'password123');

    const res = await request(app)
      .put('/v1/user/self')
      .set('Authorization', authHeader)
      .send({
        email: 'newemail@example.com',
      });

    expect(res.statusCode).toEqual(400);
  });
});
