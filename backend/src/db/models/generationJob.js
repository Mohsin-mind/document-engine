const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/db');

const GenerationJob = sequelize.define('GenerationJob', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  submissionId: { type: DataTypes.UUID, allowNull: false },
  documentDefinitionId: { type: DataTypes.UUID, allowNull: false },
  status: {
    type: DataTypes.ENUM('queued', 'rendering_docx', 'converting_pdf', 'completed', 'failed'),
    allowNull: false,
    defaultValue: 'queued',
  },
  bullmqJobId: { type: DataTypes.STRING, allowNull: true, field: 'bullmq_job_id' },
  progress: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  error: { type: DataTypes.JSONB, allowNull: true },
  docxArtifactId: { type: DataTypes.UUID, allowNull: true },
  pdfArtifactId: { type: DataTypes.UUID, allowNull: true },
  completedAt: { type: DataTypes.DATE, allowNull: true },
}, {
  tableName: 'generation_jobs',
  indexes: [{ fields: ['status', 'created_at'] }, { fields: ['submission_id'] }],
});

module.exports = GenerationJob;
