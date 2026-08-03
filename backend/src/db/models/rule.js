const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/db');

const Rule = sequelize.define('Rule', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  questionSetId: { type: DataTypes.UUID, allowNull: false },
  versionNo: { type: DataTypes.INTEGER, allowNull: false },
  status: { type: DataTypes.ENUM('draft', 'published'), allowNull: false, defaultValue: 'draft' },
  definition: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  publishedAt: { type: DataTypes.DATE, allowNull: true },
}, {
  tableName: 'rules',
  indexes: [{ unique: true, fields: ['question_set_id', 'version_no'] }],
});

module.exports = Rule;
