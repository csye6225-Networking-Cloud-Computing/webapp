// models/image.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const User = require('./user');

const Image = sequelize.define('Image', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    readOnly: true,  // Swagger interpretation
  },
  file_name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  url: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  upload_date: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    readOnly: true,  // Swagger interpretation
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: User,
      key: 'id',
    },
    unique: true, // Ensures each user can only have one profile picture
  },
}, {
  timestamps: false,
  tableName: 'image',
});

Image.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

module.exports = Image;
