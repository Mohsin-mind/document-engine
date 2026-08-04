const config = require('../../config');
const { DiskStorage } = require('./disk.storage');

let instance = null;

function getStorage() {
  if (!instance) {
    if (config.storage.driver === 'disk') {
      instance = new DiskStorage(config.storage.root);
    } else {
      throw new Error(`Unsupported storage driver: ${config.storage.driver}`);
    }
  }
  return instance;
}

module.exports = { getStorage };
