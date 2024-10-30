const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const User = require('./user');  // Ensure you import User

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
    unique: true, // Ensure each user can only have one profile picture
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
    type: DataTypes.JSON, // Store metadata (e.g., file name, content type, upload date)
    allowNull: true,
  },
}, {
  timestamps: true,
  tableName: 'ProfilePictures',
});

ProfilePicture.belongsTo(User, { foreignKey: 'userId', as: 'user' });

module.exports = ProfilePicture;
