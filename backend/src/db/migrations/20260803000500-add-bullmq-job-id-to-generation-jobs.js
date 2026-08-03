'use strict';

const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.addColumn('generation_jobs', 'bullmq_job_id', {
      type: DataTypes.STRING,
      allowNull: true,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('generation_jobs', 'bullmq_job_id');
  },
};
