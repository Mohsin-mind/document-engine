const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/db');

const Template = sequelize.define('Template', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  name: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT },
  status: { type: DataTypes.ENUM('draft', 'published'), allowNull: false, defaultValue: 'draft' },
  latestVersionId: { type: DataTypes.UUID, allowNull: true },
}, {
  tableName: 'templates',
});

module.exports = Template;
