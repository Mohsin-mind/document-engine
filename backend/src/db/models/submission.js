const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/db');

const Submission = sequelize.define('Submission', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  questionSetVersionId: { type: DataTypes.UUID, allowNull: false },
  status: { type: DataTypes.ENUM('draft', 'submitted'), allowNull: false, defaultValue: 'draft' },
  answers: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  submittedAt: { type: DataTypes.DATE, allowNull: true },
}, {
  tableName: 'submissions',
  indexes: [{ fields: ['status', 'created_at'] }],
});

module.exports = Submission;
