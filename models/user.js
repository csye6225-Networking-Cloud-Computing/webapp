// models/user.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const ProfilePicture = require('./profilePicture');  // Assuming the image model is named ProfilePicture

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  first_name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  last_name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
    writeOnly: true,  // Indicates this should be write-only
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true,
    },
  },
}, {
  timestamps: true,
  createdAt: 'account_created',
  updatedAt: 'account_updated',
  tableName: 'user',
});

User.hasOne(ProfilePicture, { foreignKey: 'user_id', as: 'profilePicture' });

module.exports = User;
