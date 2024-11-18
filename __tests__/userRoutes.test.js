const AWSMock = require('aws-sdk-mock');
const AWS = require('aws-sdk');
const request = require('supertest');
const app = require('../app');
const { sequelize } = require('../config/database');
const User = require('../models/user');

// __tests__/userRoutes.test.js

// 1. Mock 'node-statsd' before importing the app to prevent real UDP connections
jest.mock('node-statsd', () => {
  return jest.fn().mockImplementation(() => {
      return {
          increment: jest.fn(),
          gauge: jest.fn(),
          timing: jest.fn(),
          close: jest.fn(),
      };
  });
});

// 2. Import necessary modules after mocking 'node-statsd'
const AWSMock = require('aws-sdk-mock');
const AWS = require('aws-sdk'); // Ensure AWS SDK is properly mocked
const request = require('supertest');
const app = require('../app');
const { sequelize } = require('../config/database');
const User = require('../models/user');

beforeAll(() => {
  // 3. Set necessary environment variables
  process.env.AWS_REGION = 'us-east-1';
  process.env.S3_BUCKET_NAME = 'mocked-bucket';
  process.env.STATSD_HOST = 'localhost';
  process.env.STATSD_PORT = '8125';
  process.env.AWS_ACCESS_KEY_ID = 'mocked-access-key';
  process.env.AWS_SECRET_ACCESS_KEY = 'mocked-secret-key';
  process.env.NODE_ENV = 'test'; // Ensure the app runs in test mode

  // 4. Mock AWS services using aws-sdk-mock
  AWSMock.setSDKInstance(AWS);

  // Mock S3.upload
  AWSMock.mock('S3', 'upload', (params, callback) => {
      callback(null, { Location: 'mocked-url' });
  });

  // Mock S3.getObject
  AWSMock.mock('S3', 'getObject', (params, callback) => {
      callback(null, { Body: 'mocked-body' });
  });

  // Mock SNS.publish
  AWSMock.mock('SNS', 'publish', (params, callback) => {
      callback(null, { MessageId: 'mocked-message-id' });
  });

  // Mock CloudWatch.putMetricData
  AWSMock.mock('CloudWatch', 'putMetricData', (params, callback) => {
      callback(null, {});
  });

  // Mock CognitoIdentityServiceProvider.adminInitiateAuth for authentication
  AWSMock.mock('CognitoIdentityServiceProvider', 'adminInitiateAuth', (params, callback) => {
      callback(null, { 
          AuthenticationResult: { 
              AccessToken: 'mocked-access-token',
              IdToken: 'mocked-id-token',
              RefreshToken: 'mocked-refresh-token',
          }
      });
  });

  // Add more AWS service mocks if your application uses them
});

afterEach(() => {
  // 5. Restore AWS mocks and clear Jest mocks after each test to ensure isolation
  AWSMock.restore();
  jest.clearAllMocks();
});

afterAll(async () => {
  // 6. Close Sequelize connection after all tests
  await sequelize.close();
});

describe('User Routes', () => {
  beforeEach(async () => {
      // 7. Reset the database before each test to ensure a clean state
      await sequelize.sync({ force: true });
  });

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
      // Adjust expectations based on actual response structure
      expect(res.body).toHaveProperty('firstName', 'John');
      expect(res.body).toHaveProperty('lastName', 'Doe');
      expect(res.body).toHaveProperty('id');
      // Uncomment the following line if 'email' is returned in the response
      // expect(res.body).toHaveProperty('email', 'john.doe@example.com');
  });

  it('should return the authenticated user’s information', async () => {
      // 8. Create a user directly in the database
      const user = await User.create({
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
          password: 'password123', // Ensure this password matches what the auth middleware expects
          verified: true,
      });

      // 9. Use the mocked AccessToken for authentication
      const authHeader = `Bearer mocked-access-token`;

      const res = await request(app)
          .get('/v1/user/self')
          .set('Authorization', authHeader);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('email', 'john.doe@example.com');
  });

  it('should update the authenticated user’s information', async () => {
      // 10. Create a user directly in the database
      const user = await User.create({
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
          password: 'password123', // Ensure this password matches what the auth middleware expects
          verified: true,
      });

      // 11. Use the mocked AccessToken for authentication
      const authHeader = `Bearer mocked-access-token`;

      const res = await request(app)
          .put('/v1/user/self')
          .set('Authorization', authHeader)
          .send({
              first_name: 'Johnny',
              last_name: 'Smith',
              password: 'newpassword123',
          });

      expect(res.statusCode).toEqual(204);
  });

  it('should not allow updates to restricted fields like email or account_created', async () => {
      // 12. Create a user directly in the database
      const user = await User.create({
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
          password: 'password123', // Ensure this password matches what the auth middleware expects
          verified: true,
      });

      // 13. Use the mocked AccessToken for authentication
      const authHeader = `Bearer mocked-access-token`;

      const res = await request(app)
          .put('/v1/user/self')
          .set('Authorization', authHeader)
          .send({
              email: 'newemail@example.com', // Attempt to update restricted field
          });

      expect(res.statusCode).toEqual(400);
  });
});
