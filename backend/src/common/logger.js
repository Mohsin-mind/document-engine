const crypto = require('crypto');

function createLogger(moduleName = 'app') {
  const prefix = moduleName;
  return {
    info: (...args) => console.log(`[${prefix}]`, ...args),
    warn: (...args) => console.warn(`[${prefix}]`, ...args),
    error: (...args) => console.error(`[${prefix}]`, ...args),
    child: (name) => createLogger(`${prefix}:${name}`),
  };
}

const requestId = () => crypto.randomUUID();

module.exports = { createLogger, requestId };
