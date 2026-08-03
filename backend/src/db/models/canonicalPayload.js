const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/db');

const CanonicalPayload = sequelize.define('CanonicalPayload', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  submissionId: { type: DataTypes.UUID, allowNull: false, unique: true },
  payload: { type: DataTypes.JSONB, allowNull: false },
}, {
  tableName: 'canonical_payloads',
});

module.exports = CanonicalPayload;
