const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/db');

const ReviewArtifact = sequelize.define('ReviewArtifact', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  artifactId: { type: DataTypes.UUID, allowNull: false },
  status: { type: DataTypes.ENUM('pending', 'approved', 'rejected'), allowNull: false, defaultValue: 'pending' },
  reviewedDocxKey: { type: DataTypes.STRING, allowNull: true },
  reviewedPdfKey: { type: DataTypes.STRING, allowNull: true },
  reviewerNote: { type: DataTypes.TEXT, allowNull: true },
  reviewedAt: { type: DataTypes.DATE, allowNull: true },
  approvedAt: { type: DataTypes.DATE, allowNull: true },
}, {
  tableName: 'review_artifacts',
  indexes: [{ unique: true, fields: ['artifact_id'] }],
});

module.exports = ReviewArtifact;
