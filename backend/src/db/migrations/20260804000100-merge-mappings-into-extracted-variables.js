'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE template_versions tv
      SET extracted_variables = sub.mapped
      FROM (
        SELECT tv.id,
          jsonb_agg(
            var
            || jsonb_build_object('id', 'var_' || lpad(ord::text, 3, '0'))
            || jsonb_build_object(
                 'jsonPath',
                 (SELECT dd.mappings ->> (var ->> 'name')
                  FROM document_definitions dd
                  WHERE dd.template_version_id = tv.id)
               )
            ORDER BY ord
          ) AS mapped
        FROM template_versions tv
        CROSS JOIN LATERAL jsonb_array_elements(tv.extracted_variables) WITH ORDINALITY AS t(var, ord)
        GROUP BY tv.id
      ) sub
      WHERE sub.id = tv.id
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE template_versions tv
      SET extracted_variables = (
        SELECT jsonb_agg(var - 'id' - 'jsonPath' ORDER BY ord)
        FROM jsonb_array_elements(tv.extracted_variables) WITH ORDINALITY AS t(var, ord)
      )
    `);
  },
};
