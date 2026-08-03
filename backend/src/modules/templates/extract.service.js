const PizZip = require('pizzip');
const { ValidationError } = require('../../common/errors');

const TOKEN_RE = /{([^{}]+)}/g;

function loadDocumentXml(buffer) {
  let zip;
  try {
    zip = new PizZip(buffer);
  } catch (err) {
    throw new ValidationError('File is not a valid DOCX (ZIP) archive');
  }
  const file = zip.file('word/document.xml');
  if (!file) throw new ValidationError('File has no word/document.xml — not a DOCX template');
  return file.asText();
}

function extractVariables(buffer) {
  const xml = loadDocumentXml(buffer);
  const variables = [];
  const seen = new Set();

  for (const match of xml.matchAll(TOKEN_RE)) {
    const raw = match[1];
    let name = raw.trim();
    let type = 'scalar';

    if (name.startsWith('#')) {
      name = name.slice(1).trim();
      type = 'loop';
    } else if (name.startsWith('/')) {
      continue;
    }

    if (!name || /[{}[\]/]/.test(name) || seen.has(name)) continue;
    seen.add(name);
    variables.push({ name, type });
  }

  const loopNames = new Set(variables.filter((v) => v.type === 'loop').map((v) => v.name));
  return variables.filter(
    (v) => !(v.type === 'scalar' && loopNames.has(v.name))
  );
}

module.exports = { extractVariables, loadDocumentXml };
