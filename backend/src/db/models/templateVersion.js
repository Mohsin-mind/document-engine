const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/db');

const TemplateVersion = sequelize.define('TemplateVersion', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  templateId: { type: DataTypes.UUID, allowNull: false },
  versionNo: { type: DataTypes.INTEGER, allowNull: false },
  status: { type: DataTypes.ENUM('draft', 'published'), allowNull: false, defaultValue: 'draft' },
  storageKey: { type: DataTypes.STRING, allowNull: false },
  extractedVariables: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
  mappingStatus: { type: DataTypes.ENUM('unmapped', 'mapped', 'mapped-validated'), allowNull: false, defaultValue: 'unmapped' },
  docxTestStatus: { type: DataTypes.ENUM('not-tested', 'passed', 'failed'), allowNull: false, defaultValue: 'not-tested' },
  pdfTestStatus: { type: DataTypes.ENUM('not-tested', 'passed', 'failed'), allowNull: false, defaultValue: 'not-tested' },
  testDocxKey: { type: DataTypes.STRING, allowNull: true },
  testPdfKey: { type: DataTypes.STRING, allowNull: true },
  publishedAt: { type: DataTypes.DATE, allowNull: true },
}, {
  tableName: 'template_versions',
  indexes: [{ unique: true, fields: ['template_id', 'version_no'] }],
});

module.exports = TemplateVersion;
