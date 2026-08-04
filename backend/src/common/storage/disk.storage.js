const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { StorageInterface } = require('./storage.interface');
const { NotFoundError } = require('../errors');

class DiskStorage extends StorageInterface {
  constructor(rootDir) {
    super();
    this.root = path.resolve(rootDir);
  }

  _resolve(key) {
    const safe = path.normalize(key).replace(/^(\.\.(\/|\\|$))+/, '');
    return path.join(this.root, safe);
  }

  async save({ key, data }) {
    const target = this._resolve(key);
    await fsp.mkdir(path.dirname(target), { recursive: true });
    await fsp.writeFile(target, data);
    return { key, size: Buffer.isBuffer(data) ? data.length : Buffer.byteLength(data) };
  }

  async read({ key }) {
    const target = this._resolve(key);
    try {
      return await fsp.readFile(target);
    } catch (err) {
      if (err.code === 'ENOENT') throw new NotFoundError(`File not found: ${key}`);
      throw err;
    }
  }

  async delete({ key }) {
    const target = this._resolve(key);
    try {
      await fsp.unlink(target);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
  }

  async deleteDir(key) {
    const target = this._resolve(key);
    const dirs = [target, path.dirname(target)];
    for (const dir of dirs) {
      try {
        await fsp.rmdir(dir);
      } catch (err) {
        if (err.code !== 'ENOENT' && err.code !== 'ENOTEMPTY') throw err;
      }
    }
  }

  url({ key, downloadName }) {
    const qs = downloadName ? `?download=${encodeURIComponent(downloadName)}` : '';
    return `/api/files/${encodeURIComponent(key)}${qs}`;
  }

  exists(key) {
    return fs.existsSync(this._resolve(key));
  }

  tmpFile(prefix) {
    const dir = path.join(this.root, 'temp');
    fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, `${prefix}-${crypto.randomUUID()}`);
  }
}

module.exports = { DiskStorage };
