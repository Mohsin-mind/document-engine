'use strict';

const now = new Date();

// Fixed IDs so this seeder is idempotent (re-running db:seed updates in place).
const qsId = 'a41394da-b2e2-46a1-ac53-cc8017f73200';
const qsVersionId = '2ca64034-ed85-4637-b43f-1131349340bc';
const ruleId = 'ec86c094-5d3a-4050-9790-b1c304ab5526';

// Questionnaire definition. Question ids are the contract that rules
// ({answers.<id>}) and template mappings (canonical paths) depend on —
// the UI itself is driven entirely by this definition (pulled via
// GET /api/questionnaire from the published version).
const definition = {
  sections: [
    {
      id: 'personal',
      title: 'Personal Details',
      questions: [
        {
          id: 'fullName',
          type: 'text',
          label: 'Full legal name',
          required: true,
          validation: { minLength: 3 },
        },
        {
          id: 'maritalStatus',
          type: 'dropdown',
          label: 'Marital status',
          required: true,
          options: ['single', 'married', 'widowed', 'divorced'],
        },
        {
          id: 'spouseName',
          type: 'text',
          label: 'Spouse full name',
          required: true,
          condition: { field: 'maritalStatus', equals: 'married' },
        },
        {
          id: 'city',
          type: 'text',
          label: 'City, County, State (e.g. Dallas, Dallas County, Texas)',
          required: true,
          validation: { minLength: 3 },
        },
        {
          id: 'state',
          type: 'text',
          label: 'State',
          required: true,
          validation: { minLength: 2 },
        },
        {
          id: 'willDate',
          type: 'text',
          label: 'Will date (e.g. August 4, 2026)',
          required: true,
          validation: { minLength: 5 },
        },
      ],
    },
    {
      id: 'children',
      title: 'Children',
      questions: [
        {
          id: 'children',
          type: 'repeatable',
          label: 'Children',
          addLabel: 'Add child',
          min: 0,
          max: 10,
          fields: [
            { id: 'name', type: 'text', label: 'Child full name', required: true },
            { id: 'dob', type: 'date', label: 'Date of birth', required: true },
          ],
        },
      ],
    },
    {
      id: 'executor',
      title: 'Executor & Guardians',
      questions: [
        {
          id: 'executorName',
          type: 'text',
          label: 'Executor full name',
          required: true,
          validation: { minLength: 3 },
        },
        {
          id: 'executorCity',
          type: 'text',
          label: 'Executor city',
          required: true,
          validation: { minLength: 2 },
        },
        {
          id: 'wantGuardian',
          type: 'yesno',
          label: 'Do you want to nominate guardians for your children?',
          required: true,
        },
        {
          id: 'primaryGuardianName',
          type: 'text',
          label: 'Primary guardian full name',
          required: true,
          condition: { field: 'wantGuardian', equals: 'yes' },
        },
        {
          id: 'alternateGuardianName',
          type: 'text',
          label: 'Alternate guardian full name',
          required: true,
          condition: { field: 'wantGuardian', equals: 'yes' },
        },
      ],
    },
  ],
};

// Rule definition. `computed` keys are the canonical paths the WOLF
// template mappings point to (customer.*, executor.*, guardian.*,
// children[].fullName via groupMaps).
const ruleDefinition = {
  flags: [
    { key: 'hasSpouse', when: { field: 'maritalStatus', equals: 'married' } },
    { key: 'hasChildren', when: { group: 'children', min: 1 } },
    { key: 'showGuardianClause', when: { field: 'wantGuardian', equals: 'yes' } },
  ],
  computed: [
    { key: 'customer.fullName', value: '{answers.fullName}' },
    { key: 'customer.spouseName', value: '{answers.spouseName}' },
    { key: 'customer.city', value: '{answers.city}' },
    { key: 'customer.state', value: '{answers.state}' },
    { key: 'customer.date', value: '{answers.willDate}' },
    { key: 'executor.fullName', value: '{answers.executorName}' },
    { key: 'guardian.primary', value: '{answers.primaryGuardianName}' },
    { key: 'guardian.alternate', value: '{answers.alternateGuardianName}' },
    {
      key: 'computed.executorClause',
      template: 'I appoint {answers.executorName} of {answers.executorCity} as executor.',
    },
  ],
  includeGroups: ['children'],
  groupMaps: { children: { fullName: '{item.name}' } },
};

module.exports = {
  async up(queryInterface) {
    await queryInterface.upsert('question_sets', {
      id: qsId,
      name: 'Last Will & Testament Questionnaire',
      description: 'Collects all data referenced by the WOLF Pour-Over Will template',
      status: 'published',
      latest_version_id: qsVersionId,
      created_at: now,
      updated_at: now,
    });

    await queryInterface.upsert('question_set_versions', {
      id: qsVersionId,
      question_set_id: qsId,
      version_no: 1,
      status: 'published',
      definition: JSON.stringify(definition),
      published_at: now,
      created_at: now,
      updated_at: now,
    });

    await queryInterface.upsert('rules', {
      id: ruleId,
      question_set_id: qsId,
      version_no: 1,
      status: 'published',
      definition: JSON.stringify(ruleDefinition),
      published_at: now,
      created_at: now,
      updated_at: now,
    });
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('rules', { id: ruleId });
    await queryInterface.bulkDelete('question_set_versions', { id: qsVersionId });
    await queryInterface.bulkDelete('question_sets', { id: qsId });
  },
};
