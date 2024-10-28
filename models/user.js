const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

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
    writeOnly: true,
  },
  firstName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  lastName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  profilePicUrl: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  profilePicKey: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  profilePicMetadata: {
    type: DataTypes.JSON,
    allowNull: true,
  },
}, {
  timestamps: true,
  createdAt: 'account_created',
  updatedAt: 'account_updated',
  tableName: 'user',
});

module.exports = User;
