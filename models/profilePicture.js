const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const User = require('./user');  // Ensure the correct path to the User model

const ProfilePicture = sequelize.define('ProfilePicture', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: User,
      key: 'id',
    },
    unique: true,
  },
  url: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  key: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
  },
}, {
  timestamps: true,
  tableName: 'image',
});

// Define associations after exporting
ProfilePicture.belongsTo(User, { foreignKey: 'userId', as: 'user' });

module.exports = ProfilePicture;
