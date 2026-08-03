'use strict';

const { randomUUID } = require('crypto');

const qsId = randomUUID();
const qsVersionId = randomUUID();
const ruleId = randomUUID();
const now = new Date();

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
      ],
    },
    {
      id: 'children',
      title: 'Children',
      repeatable: {
        id: 'children',
        label: 'Child',
        addLabel: 'Add child',
        min: 0,
        max: 10,
        fields: [
          { id: 'name', type: 'text', label: 'Child full name', required: true },
          { id: 'dob', type: 'date', label: 'Date of birth', required: true },
        ],
      },
    },
  ],
};

module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkInsert('question_sets', [
      {
        id: qsId,
        name: 'Last Will & Testament Questionnaire',
        description: 'Sample questionnaire used by the customer simulation',
        status: 'published',
        latest_version_id: qsVersionId,
        created_at: now,
        updated_at: now,
      },
    ]);

    await queryInterface.bulkInsert('question_set_versions', [
      {
        id: qsVersionId,
        question_set_id: qsId,
        version_no: 1,
        status: 'published',
        definition: JSON.stringify(definition),
        published_at: now,
        created_at: now,
        updated_at: now,
      },
    ]);

    await queryInterface.bulkInsert('rules', [
      {
        id: ruleId,
        question_set_id: qsId,
        version_no: 1,
        status: 'published',
        definition: JSON.stringify({
          flags: [
            { key: 'hasSpouse', when: { field: 'maritalStatus', equals: 'married' } },
            { key: 'hasChildren', when: { group: 'children', min: 1 } },
            { key: 'showGuardianClause', when: { group: 'children', min: 1 } },
          ],
          computed: [
            {
              key: 'customer.fullName',
              value: '{answers.fullName}',
            },
          ],
        }),
        published_at: now,
        created_at: now,
        updated_at: now,
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('rules', { id: ruleId });
    await queryInterface.bulkDelete('question_set_versions', { id: qsVersionId });
    await queryInterface.bulkDelete('question_sets', { id: qsId });
  },
};
