const IORedis = require('ioredis');
const config = require('../config');

let connection = null;

function getConnection() {
  if (!connection) {
    connection = new IORedis(config.redis.port, config.redis.host, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
    connection.on('error', (err) => console.error('[redis]', err.message));
  }
  return connection;
}

module.exports = { getConnection };
