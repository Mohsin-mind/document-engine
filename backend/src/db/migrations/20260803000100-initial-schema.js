'use strict';

const { DataTypes } = require('sequelize');

module.exports = {
  async up(queryInterface) {
    const uuid = { type: DataTypes.UUID, primaryKey: true, allowNull: false };
    const timestamps = {
      createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
      updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at' },
    };

    await queryInterface.createTable('question_sets', {
      id: uuid,
      name: { type: DataTypes.STRING, allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      status: { type: DataTypes.ENUM('draft', 'published'), allowNull: false, defaultValue: 'draft' },
      latestVersionId: { type: DataTypes.UUID, allowNull: true, field: "latest_version_id" },
      ...timestamps,
    });

    await queryInterface.createTable('question_set_versions', {
      id: uuid,
      questionSetId: { type: DataTypes.UUID, allowNull: false, field: 'question_set_id' },
      versionNo: { type: DataTypes.INTEGER, allowNull: false, field: 'version_no' },
      status: { type: DataTypes.ENUM('draft', 'published'), allowNull: false, defaultValue: 'draft' },
      definition: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      publishedAt: { type: DataTypes.DATE, allowNull: true, field: 'published_at' },
      ...timestamps,
    });

    await queryInterface.addIndex('question_set_versions', ['question_set_id', 'version_no'], { unique: true });

    await queryInterface.createTable('rules', {
      id: uuid,
      questionSetId: { type: DataTypes.UUID, allowNull: false, field: 'question_set_id' },
      versionNo: { type: DataTypes.INTEGER, allowNull: false, field: 'version_no' },
      status: { type: DataTypes.ENUM('draft', 'published'), allowNull: false, defaultValue: 'draft' },
      definition: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      publishedAt: { type: DataTypes.DATE, allowNull: true, field: 'published_at' },
      ...timestamps,
    });

    await queryInterface.addIndex('rules', ['question_set_id', 'version_no'], { unique: true });

    await queryInterface.createTable('templates', {
      id: uuid,
      name: { type: DataTypes.STRING, allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      status: { type: DataTypes.ENUM('draft', 'published'), allowNull: false, defaultValue: 'draft' },
      latestVersionId: { type: DataTypes.UUID, allowNull: true, field: "latest_version_id" },
      ...timestamps,
    });

    await queryInterface.createTable('template_versions', {
      id: uuid,
      templateId: { type: DataTypes.UUID, allowNull: false, field: 'template_id' },
      versionNo: { type: DataTypes.INTEGER, allowNull: false, field: 'version_no' },
      status: { type: DataTypes.ENUM('draft', 'published'), allowNull: false, defaultValue: 'draft' },
      storageKey: { type: DataTypes.STRING, allowNull: false, field: 'storage_key' },
      extractedVariables: { type: DataTypes.JSONB, allowNull: false, defaultValue: [], field: 'extracted_variables' },
      mappingStatus: {
        type: DataTypes.ENUM('unmapped', 'mapped', 'mapped-validated'),
        allowNull: false,
        defaultValue: 'unmapped',
        field: 'mapping_status',
      },
      docxTestStatus: {
        type: DataTypes.ENUM('not-tested', 'passed', 'failed'),
        allowNull: false,
        defaultValue: 'not-tested',
        field: 'docx_test_status',
      },
      pdfTestStatus: {
        type: DataTypes.ENUM('not-tested', 'passed', 'failed'),
        allowNull: false,
        defaultValue: 'not-tested',
        field: 'pdf_test_status',
      },
      testDocxKey: { type: DataTypes.STRING, allowNull: true, field: 'test_docx_key' },
      testPdfKey: { type: DataTypes.STRING, allowNull: true, field: 'test_pdf_key' },
      publishedAt: { type: DataTypes.DATE, allowNull: true, field: 'published_at' },
      ...timestamps,
    });

    await queryInterface.addIndex('template_versions', ['template_id', 'version_no'], { unique: true });

    await queryInterface.createTable('document_definitions', {
      id: uuid,
      templateVersionId: { type: DataTypes.UUID, allowNull: false, field: 'template_version_id' },
      name: { type: DataTypes.STRING, allowNull: false },
      mappings: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      status: { type: DataTypes.ENUM('draft', 'published'), allowNull: false, defaultValue: 'draft' },
      publishedAt: { type: DataTypes.DATE, allowNull: true, field: 'published_at' },
      ...timestamps,
    });

    await queryInterface.addIndex('document_definitions', ['template_version_id', 'name'], { unique: true });

    await queryInterface.createTable('submissions', {
      id: uuid,
      questionSetVersionId: { type: DataTypes.UUID, allowNull: false, field: 'question_set_version_id' },
      status: { type: DataTypes.ENUM('draft', 'submitted'), allowNull: false, defaultValue: 'draft' },
      answers: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      submittedAt: { type: DataTypes.DATE, allowNull: true, field: 'submitted_at' },
      ...timestamps,
    });

    await queryInterface.addIndex('submissions', ['status', 'created_at']);

    await queryInterface.createTable('canonical_payloads', {
      id: uuid,
      submissionId: { type: DataTypes.UUID, allowNull: false, unique: true, field: 'submission_id' },
      payload: { type: DataTypes.JSONB, allowNull: false },
      ...timestamps,
    });

    await queryInterface.createTable('generation_jobs', {
      id: uuid,
      submissionId: { type: DataTypes.UUID, allowNull: false, field: 'submission_id' },
      documentDefinitionId: { type: DataTypes.UUID, allowNull: false, field: 'document_definition_id' },
      status: {
        type: DataTypes.ENUM('queued', 'rendering_docx', 'converting_pdf', 'completed', 'failed'),
        allowNull: false,
        defaultValue: 'queued',
      },
      progress: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      error: { type: DataTypes.JSONB, allowNull: true },
      docxArtifactId: { type: DataTypes.UUID, allowNull: true, field: 'docx_artifact_id' },
      pdfArtifactId: { type: DataTypes.UUID, allowNull: true, field: 'pdf_artifact_id' },
      completedAt: { type: DataTypes.DATE, allowNull: true, field: 'completed_at' },
      ...timestamps,
    });

    await queryInterface.addIndex('generation_jobs', ['status', 'created_at']);
    await queryInterface.addIndex('generation_jobs', ['submission_id']);

    await queryInterface.createTable('artifacts', {
      id: uuid,
      submissionId: { type: DataTypes.UUID, allowNull: false, field: 'submission_id' },
      generationJobId: { type: DataTypes.UUID, allowNull: true, field: 'generation_job_id' },
      kind: { type: DataTypes.ENUM('docx', 'pdf'), allowNull: false },
      source: { type: DataTypes.ENUM('original', 'reviewed'), allowNull: false, defaultValue: 'original' },
      storageKey: { type: DataTypes.STRING, allowNull: false, field: 'storage_key' },
      ...timestamps,
    });

    await queryInterface.addIndex('artifacts', ['submission_id']);

    await queryInterface.createTable('review_artifacts', {
      id: uuid,
      artifactId: { type: DataTypes.UUID, allowNull: false, field: 'artifact_id' },
      status: { type: DataTypes.ENUM('pending', 'approved', 'rejected'), allowNull: false, defaultValue: 'pending' },
      reviewedDocxKey: { type: DataTypes.STRING, allowNull: true, field: 'reviewed_docx_key' },
      reviewedPdfKey: { type: DataTypes.STRING, allowNull: true, field: 'reviewed_pdf_key' },
      reviewerNote: { type: DataTypes.TEXT, allowNull: true, field: 'reviewer_note' },
      reviewedAt: { type: DataTypes.DATE, allowNull: true, field: 'reviewed_at' },
      approvedAt: { type: DataTypes.DATE, allowNull: true, field: 'approved_at' },
      ...timestamps,
    });

    await queryInterface.addIndex('review_artifacts', ['artifact_id'], { unique: true });

    await queryInterface.createTable('e_sign_requests', {
      id: uuid,
      artifactId: { type: DataTypes.UUID, allowNull: false, field: 'artifact_id' },
      status: { type: DataTypes.ENUM('pending', 'sent', 'signed', 'failed'), allowNull: false, defaultValue: 'pending' },
      providerRef: { type: DataTypes.STRING, allowNull: true, field: 'provider_ref' },
      signedPdfKey: { type: DataTypes.STRING, allowNull: true, field: 'signed_pdf_key' },
      webhookPayload: { type: DataTypes.JSONB, allowNull: true, field: 'webhook_payload' },
      ...timestamps,
    });

    await queryInterface.addIndex('e_sign_requests', ['status']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('e_sign_requests');
    await queryInterface.dropTable('review_artifacts');
    await queryInterface.dropTable('artifacts');
    await queryInterface.dropTable('generation_jobs');
    await queryInterface.dropTable('canonical_payloads');
    await queryInterface.dropTable('submissions');
    await queryInterface.dropTable('document_definitions');
    await queryInterface.dropTable('template_versions');
    await queryInterface.dropTable('templates');
    await queryInterface.dropTable('rules');
    await queryInterface.dropTable('question_set_versions');
    await queryInterface.dropTable('question_sets');
  },
};
