const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  appName: process.env.APP_NAME || 'Document Engine',
  db: {
    user: process.env.DB_USER_NAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    host: process.env.DB_HOST_NAME,
    dialect: process.env.DB_DIALECT || 'postgres',
    port: parseInt(process.env.DB_PORT || '5432', 10),
  },
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  },
  storage: {
    driver: process.env.STORAGE_DRIVER || 'disk',
    root: path.resolve(__dirname, '..', '..', '..', process.env.STORAGE_ROOT || '../storage'),
  },
  soffice: {
    bin: process.env.SOFFICE_BIN || 'soffice',
  },
};

module.exports = config;
