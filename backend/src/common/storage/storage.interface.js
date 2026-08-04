class StorageInterface {
  async save({ key, data }) {
    throw new Error('save() not implemented');
  }
  async read({ key }) {
    throw new Error('read() not implemented');
  }
  async delete({ key }) {
    throw new Error('delete() not implemented');
  }
  async deleteDir(key) {
    throw new Error('deleteDir() not implemented');
  }
  url({ key, downloadName }) {
    throw new Error('url() not implemented');
  }
}

module.exports = { StorageInterface };
