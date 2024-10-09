const request = require('supertest');
const app = require('../app');  // Import your Express app
const { sequelize } = require('../config/database');  // Import the Sequelize instance

beforeAll(async () => {
  // Sync the database schema
  try {
    await sequelize.sync({ force: true });
    console.log('Database synced successfully');
  } catch (error) {
    console.error('Error syncing database:', error);
  }
});

afterAll(async () => {
  // Close the Sequelize connection after all tests
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
    // Create the first user
    await request(app)
      .post('/v1/user')
      .send({
        first_name: 'John',
        last_name: 'Doe',
        email: 'john.doe@example.com',
        password: 'password123',
      });

    // Attempt to create another user with the same email
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

    // Encode the Basic Auth credentials (email:password)
    const credentials = Buffer.from('john.doe@example.com:password123').toString('base64');
    
    const res = await request(app)
      .get('/v1/user/self')
      .set('Authorization', `Basic ${credentials}`);  // Set Basic Auth with encoded credentials

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('email', 'john.doe@example.com');
  });

  // Test for updating the authenticated user's information (PUT)
  it('should update the authenticated user’s information', async () => {
    // Encode the Basic Auth credentials (email:password)
    const credentials = Buffer.from('john.doe@example.com:password123').toString('base64');

    const res = await request(app)
      .put('/v1/user/self')
      .set('Authorization', `Basic ${credentials}`)  // Use Basic Auth for the request
      .send({
        first_name: 'Johnny',
        last_name: 'Doe',
        password: 'newpassword123',
      });
    expect(res.statusCode).toEqual(204);  // No content expected for a successful update
  });

  // Test to ensure that restricted fields cannot be updated
  it('should not allow updates to restricted fields like email or account_created', async () => {
    // Encode the Basic Auth credentials (email:password)
    const credentials = Buffer.from('john.doe@example.com:newpassword123').toString('base64');

    const res = await request(app)
      .put('/v1/user/self')
      .set('Authorization', `Basic ${credentials}`)  // Use Basic Auth for the request
      .send({
        email: 'newemail@example.com',  // Attempt to update restricted field
      });
    expect(res.statusCode).toEqual(400);  // Expecting 400 Bad Request for restricted field update
  });
});
