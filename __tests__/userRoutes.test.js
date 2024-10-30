const request = require('supertest');
const app = require('../app');  // Import your Express app
const { sequelize } = require('../config/database');  // Import the Sequelize instance

// Clean up the database before and after each test
beforeAll(async () => {
  await sequelize.sync({ force: true });  // Force true to drop and recreate tables
});

beforeEach(async () => {
  const tables = Object.keys(sequelize.models);
  await Promise.all(
    tables.map((table) => sequelize.models[table].destroy({ truncate: true, cascade: true }))
  );
});

afterAll(async () => {
  await sequelize.close();  // Close the Sequelize connection after all tests
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

    const credentials = Buffer.from('john.doe@example.com:password123').toString('base64');

    const res = await request(app)
      .get('/v1/user/self')
      .set('Authorization', `Basic ${credentials}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('email', 'john.doe@example.com');
  });

  it('should update the authenticated user’s information', async () => {
    const credentials = Buffer.from('john.doe@example.com:password123').toString('base64');

    const res = await request(app)
      .put('/v1/user/self')
      .set('Authorization', `Basic ${credentials}`)
      .send({
        first_name: 'Johnny',
        last_name: 'Doe',
        password: 'newpassword123',
      });
    expect(res.statusCode).toEqual(204);
  });

  it('should not allow updates to restricted fields like email or account_created', async () => {
    const credentials = Buffer.from('john.doe@example.com:newpassword123').toString('base64');

    const res = await request(app)
      .put('/v1/user/self')
      .set('Authorization', `Basic ${credentials}`)
      .send({
        email: 'newemail@example.com',
      });
    expect(res.statusCode).toEqual(400);
  });
});
