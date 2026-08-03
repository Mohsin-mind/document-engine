const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const config = require('../src/config');
const { getStorage } = require('../src/common/storage');

function safeDottedParser(tag) {
  const parts = tag.split('.');
  return {
    get(scope) {
      let cur = scope;
      for (const p of parts) {
        if (cur == null) return undefined;
        cur = cur[p];
      }
      return cur;
    },
  };
}

function renderDocx(templateBuffer, payload) {
  const zip = new PizZip(templateBuffer);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    parser: safeDottedParser,
    nullGetter: (part) => {
      if (part.module === 'loop') return '';
      return `[MISSING:${part.value}]`;
    },
  });
  doc.render(payload);
  return doc.getZip().generate({
    type: 'nodebuffer',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}

function convertToPdf(docxBuffer) {
  return new Promise((resolve, reject) => {
    const storage = getStorage();
    const inFile = storage.tmpFile('convert-in');
    const outFile = inFile + '.pdf';
    const outDir = path.dirname(outFile);
    fs.writeFileSync(inFile + '.docx', docxBuffer);

    const args = ['--headless', '--convert-to', 'pdf', '--outdir', outDir, inFile + '.docx'];
    execFile(config.soffice.bin, args, { timeout: 120000 }, (err, stdout, stderr) => {
      if (err) {
        fs.unlink(inFile + '.docx', () => {});
        return reject(new Error(`LibreOffice failed: ${err.message} ${stderr}`));
      }
      fs.readFile(outFile, (readErr, pdfBuf) => {
        fs.unlink(inFile + '.docx', () => {});
        fs.unlink(outFile, () => {});
        if (readErr) return reject(new Error(`PDF output missing: ${outFile}`));
        resolve(pdfBuf);
      });
    });
  });
}

module.exports = { renderDocx, convertToPdf, safeDottedParser };
