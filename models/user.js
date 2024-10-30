// models/user.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const Image = require('./image');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    readOnly: true,  // Swagger interpretation
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
    writeOnly: true,  // Swagger interpretation: exclude from GET responses
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
  createdAt: 'account_created',  // readOnly implied for created/updated timestamps
  updatedAt: 'account_updated',
  tableName: 'user',
});

User.hasOne(Image, { foreignKey: 'user_id', as: 'profilePicture' });

module.exports = User;
