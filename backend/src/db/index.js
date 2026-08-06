const QuestionSet = require('./models/questionSet');
const QuestionSetVersion = require('./models/questionSetVersion');
const QuestionSetRule = require('./models/questionSetRule');
const Template = require('./models/template');
const TemplateVersion = require('./models/templateVersion');
const DocumentMapping = require('./models/documentMapping');
const Submission = require('./models/submission');
const GenerationJob = require('./models/generationJob');
const Artifact = require('./models/artifact');
const ReviewArtifact = require('./models/reviewArtifact');

QuestionSet.hasMany(QuestionSetVersion, { foreignKey: 'questionSetId', as: 'versions' });
QuestionSetVersion.belongsTo(QuestionSet, { foreignKey: 'questionSetId' });
QuestionSet.belongsTo(QuestionSetVersion, { as: 'latestVersion', foreignKey: 'latestVersionId' });

Template.hasMany(TemplateVersion, { foreignKey: 'templateId', as: 'versions' });
TemplateVersion.belongsTo(Template, { foreignKey: 'templateId' });
Template.belongsTo(TemplateVersion, { as: 'latestVersion', foreignKey: 'latestVersionId' });

TemplateVersion.hasOne(DocumentMapping, { foreignKey: 'templateVersionId' });
DocumentMapping.belongsTo(TemplateVersion, { foreignKey: 'templateVersionId' });
DocumentMapping.belongsTo(QuestionSet, { foreignKey: 'questionSetId' });
QuestionSet.hasMany(DocumentMapping, { foreignKey: 'questionSetId' });

Submission.belongsTo(QuestionSetVersion, { foreignKey: 'questionSetVersionId' });
QuestionSetVersion.hasMany(Submission, { foreignKey: 'questionSetVersionId' });

Submission.hasMany(GenerationJob, { foreignKey: 'submissionId', as: 'jobs' });
GenerationJob.belongsTo(Submission, { foreignKey: 'submissionId' });
DocumentMapping.hasMany(GenerationJob, { foreignKey: 'documentMappingId' });
GenerationJob.belongsTo(DocumentMapping, { foreignKey: 'documentMappingId' });

Submission.hasMany(Artifact, { foreignKey: 'submissionId' });
Artifact.belongsTo(Submission, { foreignKey: 'submissionId' });
GenerationJob.hasMany(Artifact, { foreignKey: 'generationJobId', as: 'artifacts' });
Artifact.belongsTo(GenerationJob, { foreignKey: 'generationJobId' });

Artifact.hasOne(ReviewArtifact, { foreignKey: 'artifactId' });
ReviewArtifact.belongsTo(Artifact, { foreignKey: 'artifactId' });

module.exports = {
  QuestionSet,
  QuestionSetVersion,
  QuestionSetRule,
  Template,
  TemplateVersion,
  DocumentMapping,
  Submission,
  GenerationJob,
  Artifact,
  ReviewArtifact,
};
