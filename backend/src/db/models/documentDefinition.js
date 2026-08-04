const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/db');

const DocumentDefinition = sequelize.define('DocumentDefinition', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  templateVersionId: { type: DataTypes.UUID, allowNull: false },
  questionSetId: { type: DataTypes.UUID, allowNull: true },
  name: { type: DataTypes.STRING, allowNull: false },
  status: { type: DataTypes.ENUM('draft', 'published'), allowNull: false, defaultValue: 'draft' },
  publishedAt: { type: DataTypes.DATE, allowNull: true },
}, {
  tableName: 'document_definitions',
  indexes: [{ unique: true, fields: ['template_version_id', 'name'] }],
});

module.exports = DocumentDefinition;
