const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/db');

const Artifact = sequelize.define('Artifact', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  submissionId: { type: DataTypes.UUID, allowNull: false },
  generationJobId: { type: DataTypes.UUID, allowNull: true },
  kind: { type: DataTypes.ENUM('docx', 'pdf'), allowNull: false },
  source: { type: DataTypes.ENUM('original', 'reviewed'), allowNull: false, defaultValue: 'original' },
  storageKey: { type: DataTypes.STRING, allowNull: false },
}, {
  tableName: 'artifacts',
  indexes: [{ fields: ['submission_id'] }],
});

module.exports = Artifact;
