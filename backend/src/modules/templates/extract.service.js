const PizZip = require('pizzip');
const { ValidationError } = require('../../common/errors');

const TOKEN_RE = /{([^{}]+)}/g;
const XML_PART_NAMES = [
  'word/document.xml',
  'word/header1.xml',
  'word/header2.xml',
  'word/header3.xml',
  'word/footer1.xml',
  'word/footer2.xml',
  'word/footer3.xml',
];

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

function scanPartXml(xml, variables, seen) {
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
}

function extractVariables(buffer) {
  const xml = loadDocumentXml(buffer);
  const variables = [];
  const seen = new Set();

  scanPartXml(xml, variables, seen);
  let zip;
  try {
    zip = new PizZip(buffer);
    for (const partName of XML_PART_NAMES.slice(1)) {
      const part = zip.file(partName);
      if (part) scanPartXml(part.asText(), variables, seen);
    }
  } catch (err) {
    throw new ValidationError('File is not a valid DOCX (ZIP) archive');
  }

  const loopNames = new Set(variables.filter((v) => v.type === 'loop').map((v) => v.name));
  return variables.filter(
    (v) => !(v.type === 'scalar' && loopNames.has(v.name))
  );
}

module.exports = { extractVariables, loadDocumentXml };
