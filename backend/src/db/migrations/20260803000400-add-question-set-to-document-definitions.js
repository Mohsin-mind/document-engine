'use strict';

const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.addColumn('document_definitions', 'question_set_id', {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'question_sets', key: 'id' },
      onDelete: 'SET NULL',
    });
    await queryInterface.addIndex('document_definitions', ['question_set_id']);
  },

  down: async (queryInterface) => {
    await queryInterface.removeIndex('document_definitions', ['question_set_id']);
    await queryInterface.removeColumn('document_definitions', 'question_set_id');
  },
};
