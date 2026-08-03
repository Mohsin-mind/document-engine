const QuestionSet = require('./models/questionSet');
const QuestionSetVersion = require('./models/questionSetVersion');
const Rule = require('./models/rule');
const Template = require('./models/template');
const TemplateVersion = require('./models/templateVersion');
const DocumentDefinition = require('./models/documentDefinition');
const Submission = require('./models/submission');
const CanonicalPayload = require('./models/canonicalPayload');
const GenerationJob = require('./models/generationJob');
const Artifact = require('./models/artifact');
const ReviewArtifact = require('./models/reviewArtifact');
const ESignRequest = require('./models/esignRequest');

QuestionSet.hasMany(QuestionSetVersion, { foreignKey: 'questionSetId', as: 'versions' });
QuestionSetVersion.belongsTo(QuestionSet, { foreignKey: 'questionSetId' });
QuestionSet.belongsTo(QuestionSetVersion, { as: 'latestVersion', foreignKey: 'latestVersionId' });

Template.hasMany(TemplateVersion, { foreignKey: 'templateId', as: 'versions' });
TemplateVersion.belongsTo(Template, { foreignKey: 'templateId' });
Template.belongsTo(TemplateVersion, { as: 'latestVersion', foreignKey: 'latestVersionId' });

TemplateVersion.hasOne(DocumentDefinition, { foreignKey: 'templateVersionId' });
DocumentDefinition.belongsTo(TemplateVersion, { foreignKey: 'templateVersionId' });
DocumentDefinition.belongsTo(QuestionSet, { foreignKey: 'questionSetId' });
QuestionSet.hasMany(DocumentDefinition, { foreignKey: 'questionSetId' });

Submission.belongsTo(QuestionSetVersion, { foreignKey: 'questionSetVersionId' });
QuestionSetVersion.hasMany(Submission, { foreignKey: 'questionSetVersionId' });

Submission.hasOne(CanonicalPayload, { foreignKey: 'submissionId' });
CanonicalPayload.belongsTo(Submission, { foreignKey: 'submissionId' });

Submission.hasMany(GenerationJob, { foreignKey: 'submissionId', as: 'jobs' });
GenerationJob.belongsTo(Submission, { foreignKey: 'submissionId' });
DocumentDefinition.hasMany(GenerationJob, { foreignKey: 'documentDefinitionId' });
GenerationJob.belongsTo(DocumentDefinition, { foreignKey: 'documentDefinitionId' });

Submission.hasMany(Artifact, { foreignKey: 'submissionId' });
Artifact.belongsTo(Submission, { foreignKey: 'submissionId' });
GenerationJob.hasMany(Artifact, { foreignKey: 'generationJobId', as: 'artifacts' });
Artifact.belongsTo(GenerationJob, { foreignKey: 'generationJobId' });

Artifact.hasOne(ReviewArtifact, { foreignKey: 'artifactId' });
ReviewArtifact.belongsTo(Artifact, { foreignKey: 'artifactId' });

Artifact.hasOne(ESignRequest, { foreignKey: 'artifactId' });
ESignRequest.belongsTo(Artifact, { foreignKey: 'artifactId' });

module.exports = {
  QuestionSet,
  QuestionSetVersion,
  Rule,
  Template,
  TemplateVersion,
  DocumentDefinition,
  Submission,
  CanonicalPayload,
  GenerationJob,
  Artifact,
  ReviewArtifact,
  ESignRequest,
};
