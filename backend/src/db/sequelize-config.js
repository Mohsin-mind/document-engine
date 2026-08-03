const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const common = {
  username: process.env.DB_USER_NAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  host: process.env.DB_HOST_NAME,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  dialect: process.env.DB_DIALECT || 'postgres',
  define: { underscored: true, timestamps: true },
};

module.exports = {
  development: common,
  test: { ...common, database: `${process.env.DB_DATABASE}_test` },
  production: common,
};
