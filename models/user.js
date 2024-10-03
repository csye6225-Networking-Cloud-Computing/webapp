const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID, // This will generate a UUID (similar to your varchar(36))
    defaultValue: DataTypes.UUIDV4, // Automatically generate UUID v4
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
  },
  lastName: {
    type: DataTypes.STRING,
    allowNull: false,
  }
}, {
  timestamps: true, // Enable Sequelize's automatic timestamps
  createdAt: 'account_created', 
  updatedAt: 'account_updated',
  tableName: 'user', 
});

module.exports = User;
