const PizZip = require('pizzip');

const OPENERS = { '[': ']', '{': '}' };
const INVALID_NAME_CHARS = /[\{\}\[\]]/;
const XML_PART_NAMES = ['word/document.xml', 'word/header1.xml', 'word/header2.xml', 'word/header3.xml', 'word/footer1.xml', 'word/footer2.xml', 'word/footer3.xml'];

function scanTokens(full) {
  const tokens = [];
  let i = 0;
  while (i < full.length) {
    const ch = full[i];
    const close = OPENERS[ch];
    if (close) {
      const end = full.indexOf(close, i + 1);
      if (end !== -1) {
        let name = full.slice(i + 1, end).trim();
        let kind = 'scalar';
        if (name.startsWith('#')) {
          name = name.slice(1).trim();
          kind = 'loop-open';
        } else if (name.startsWith('/')) {
          name = name.slice(1).trim();
          kind = 'loop-close';
        }
        if (name && !INVALID_NAME_CHARS.test(name)) {
          if (ch === '[' && (/\d/.test(name) || !/^[A-Z]/.test(name))) {
            i = end + 1;
            continue;
          }
          tokens.push({ name, kind, start: i, end });
          i = end + 1;
          continue;
        }
      }
    }
    i += 1;
  }
  return tokens;
}

function processParagraphXml(p) {
  const runRe = /<w:r\b[^>]*>(?:(?!<\/w:r>)[\s\S])*?<\/w:r>/g;
  const runs = [];
  let m;
  while ((m = runRe.exec(p))) {
    const raw = m[0];
    const tRe = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g;
    const tParts = [];
    let tm;
    while ((tm = tRe.exec(raw))) {
      tParts.push({ full: tm[0], content: tm[1] });
    }
    runs.push({ raw, tParts, tContent: tParts.map((t) => t.content).join('') });
  }
  if (runs.length === 0) return p;

  let full = '';
  const offsets = [];
  for (const r of runs) {
    offsets.push(full.length);
    full += r.tContent;
  }
  const tokens = scanTokens(full);
  if (tokens.length === 0) return p;

  let out = '';
  let lastIndex = 0;
  runRe.lastIndex = 0;
  let ri = 0;
  while ((m = runRe.exec(p))) {
    out += p.slice(lastIndex, m.index);
    out += processRunXml(m[0], runs[ri], offsets[ri], tokens);
    lastIndex = m.index + m[0].length;
    ri += 1;
  }
  out += p.slice(lastIndex);
  return out;
}

function processRunXml(raw, run, runStart, tokens) {
  let out = '';
  let pos = 0;
  while (pos < run.tContent.length) {
    const absolutePos = runStart + pos;
    const token = tokens.find((t) => absolutePos >= t.start && absolutePos <= t.end);
    if (!token) {
      out += run.tContent[pos];
      pos += 1;
      continue;
    }
    if (absolutePos === token.start) {
      out += token.kind === 'loop-open' ? `{#${token.name}}` : token.kind === 'loop-close' ? `{/${token.name}}` : `{${token.name}}`;
    }
    pos = Math.min(token.end + 1 - runStart, run.tContent.length);
  }
  return rewriteRunText(run, out);
}

function rewriteRunText(run, text) {
  const tRe = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g;
  let first = true;
  return run.raw.replace(tRe, () => {
    if (first) {
      first = false;
      return `<w:t xml:space="preserve">${text}</w:t>`;
    }
    return '';
  });
}

function prepareDocxForRender(buffer) {
  const zip = new PizZip(buffer);
  for (const partName of XML_PART_NAMES) {
    const part = zip.file(partName);
    if (!part) continue;
    const xml = part.asText();
    const prepared = xml
      .split('</w:p>')
      .map((p) => (p.includes('<w:r') ? processParagraphXml(p) : p))
      .join('</w:p>');
    zip.file(partName, prepared);
  }
  return zip.generate({ type: 'nodebuffer', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

module.exports = { prepareDocxForRender, scanTokens };
