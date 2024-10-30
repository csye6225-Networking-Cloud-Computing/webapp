const request = require('supertest');
const app = require('../app');  // Import your Express app
const { sequelize } = require('../config/database');  // Import the Sequelize instance

// Helper function to generate Basic Auth headers
const generateAuthHeader = (email, password) => {
  const credentials = Buffer.from(`${email}:${password}`).toString('base64');
  return `Basic ${credentials}`;
};

// Clean up the database before each test
beforeEach(async () => {
  await sequelize.sync({ force: true });
});

// Close the Sequelize connection after all tests
afterAll(async () => {
  await sequelize.close();
});

describe('User Routes', () => {
  // Test for creating a new user
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

  // Test for handling an existing email when creating a user
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

  // Test for retrieving authenticated user's information
  it('should return the authenticated user’s information', async () => {
    // Create a user for authentication
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

  // Test for updating the authenticated user's information (PUT)
  it('should update the authenticated user’s information', async () => {
    // Create and authenticate user
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

    expect(res.statusCode).toEqual(204);  // No content expected for a successful update
  });

  // Test to ensure that restricted fields cannot be updated
  it('should not allow updates to restricted fields like email or account_created', async () => {
    // Create and authenticate user
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
        email: 'newemail@example.com',  // Attempt to update restricted field
      });

    expect(res.statusCode).toEqual(400);  // Expecting 400 Bad Request for restricted field update
  });
});
