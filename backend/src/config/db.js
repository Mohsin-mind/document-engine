const { Sequelize } = require('sequelize');
const config = require('./index');

const sequelize = new Sequelize(config.db.database, config.db.user, config.db.password, {
  host: config.db.host,
  port: config.db.port,
  dialect: config.db.dialect,
  logging: config.env === 'development' ? (msg) => console.log(`[db] ${msg}`) : false,
  define: {
    underscored: true,
    timestamps: true,
  },
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
});

async function testConnection() {
  await sequelize.authenticate();
  console.log(`[db] connected to ${config.db.host}:${config.db.port}/${config.db.database}`);
}

module.exports = { sequelize, testConnection };
