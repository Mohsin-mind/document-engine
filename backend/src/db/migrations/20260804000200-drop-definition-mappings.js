'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.removeColumn('document_definitions', 'mappings');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn('document_definitions', 'mappings', {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: {},
    });
  },
};
