'use strict';

const { DataTypes } = require('sequelize');

module.exports = {
  async up(queryInterface) {
    await queryInterface.renameTable('document_definitions', 'document_mappings');
    await queryInterface.renameColumn('generation_jobs', 'document_definition_id', 'document_mapping_id');
    await queryInterface.renameTable('rules', 'question_set_rules');

    await queryInterface.addColumn('submissions', 'canonical', {
      type: DataTypes.JSONB,
      allowNull: true,
    });
    await queryInterface.sequelize.query(`
      UPDATE submissions s
      SET canonical = cp.payload
      FROM canonical_payloads cp
      WHERE cp.submission_id = s.id
    `);
    await queryInterface.dropTable('canonical_payloads');
    await queryInterface.dropTable('e_sign_requests');
  },

  async down(queryInterface) {
    await queryInterface.createTable('canonical_payloads', {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      submissionId: { type: DataTypes.UUID, allowNull: false, unique: true, field: 'submission_id' },
      payload: { type: DataTypes.JSONB, allowNull: false },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    });
    await queryInterface.sequelize.query(`
      INSERT INTO canonical_payloads (id, submission_id, payload, created_at, updated_at)
      SELECT gen_random_uuid(), id, canonical, now(), now()
      FROM submissions
      WHERE canonical IS NOT NULL
    `);
    await queryInterface.removeColumn('submissions', 'canonical');

    await queryInterface.createTable('e_sign_requests', {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      artifactId: { type: DataTypes.UUID, allowNull: false, field: 'artifact_id' },
      status: { type: DataTypes.ENUM('pending', 'sent', 'signed', 'failed'), allowNull: false, defaultValue: 'pending' },
      providerRef: { type: DataTypes.STRING, allowNull: true, field: 'provider_ref' },
      signedPdfKey: { type: DataTypes.STRING, allowNull: true, field: 'signed_pdf_key' },
      webhookPayload: { type: DataTypes.JSONB, allowNull: true, field: 'webhook_payload' },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    });

    await queryInterface.renameColumn('generation_jobs', 'document_mapping_id', 'document_definition_id');
    await queryInterface.renameTable('document_mappings', 'document_definitions');
    await queryInterface.renameTable('question_set_rules', 'rules');
  },
};
