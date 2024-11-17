// models/user.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');  // Ensure correct path here

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true,
    },
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  firstName: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'first_name',  // Map to 'first_name' in the database
  },
  lastName: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'last_name',   // Map to 'last_name' in the database
  },
  verified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  verification_token: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  token_expires_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  email_sent_at: {               // New Field
    type: DataTypes.DATE,
    allowNull: true,
  },
  email_status: {                // New Field
    type: DataTypes.STRING,
    allowNull: true,
  },
}, {
  timestamps: true,
  createdAt: 'account_created',
  updatedAt: 'account_updated',
  tableName: 'user',
});

module.exports = User;
