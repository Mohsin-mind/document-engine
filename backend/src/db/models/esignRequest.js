const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/db');

const ESignRequest = sequelize.define('ESignRequest', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  artifactId: { type: DataTypes.UUID, allowNull: false },
  status: { type: DataTypes.ENUM('pending', 'sent', 'signed', 'failed'), allowNull: false, defaultValue: 'pending' },
  providerRef: { type: DataTypes.STRING, allowNull: true },
  signedPdfKey: { type: DataTypes.STRING, allowNull: true },
  webhookPayload: { type: DataTypes.JSONB, allowNull: true },
}, {
  tableName: 'e_sign_requests',
  indexes: [{ fields: ['status'] }],
});

module.exports = ESignRequest;
