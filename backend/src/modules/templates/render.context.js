function getByPath(obj, path) {
  let cur = obj;
  for (const part of path.split('.')) {
    if (cur == null || typeof cur !== 'object') return undefined;
    const m = /^(.+?)\[(\d+)\]$/.exec(part);
    if (m) {
      cur = cur[m[1]];
      if (cur == null || !Array.isArray(cur)) return undefined;
      cur = cur[parseInt(m[2], 10)];
      continue;
    }
    cur = cur[part];
  }
  return cur;
}

function setByPath(obj, path, value) {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const m = /^(.+?)\[(\d+)\]$/.exec(parts[i]);
    if (m) {
      if (cur[m[1]] == null || !Array.isArray(cur[m[1]])) cur[m[1]] = [];
      cur = cur[m[1]][parseInt(m[2], 10)];
    } else {
      if (cur[parts[i]] == null || typeof cur[parts[i]] !== 'object') {
        cur[parts[i]] = {};
      }
      cur = cur[parts[i]];
    }
  }
  const last = parts[parts.length - 1];
  const m = /^(.+?)\[(\d+)\]$/.exec(last);
  if (m) {
    if (cur[m[1]] == null || !Array.isArray(cur[m[1]])) cur[m[1]] = [];
    cur[m[1]][parseInt(m[2], 10)] = value;
  } else {
    cur[last] = value;
  }
}

function isLoopPath(path) {
  return path.endsWith('[]');
}

function isItemPath(path) {
  return path.includes('[].');
}

function resolveMapping(canonical, path) {
  if (isLoopPath(path)) {
    const value = getByPath(canonical, path.slice(0, -2));
    return { kind: 'loop', value, ok: Array.isArray(value), arrayPath: path.slice(0, -2) };
  }
  if (isItemPath(path)) {
    const [arrayPath, ...rest] = path.split('[].');
    const sub = rest.join('[].');
    const value = getByPath(canonical, arrayPath);
    if (!Array.isArray(value)) return { kind: 'item', value, ok: false, arrayPath, sub };
    const first = value[0];
    const ok = value.length === 0 || getByPath(first, sub) !== undefined;
    return { kind: 'item', value, ok, arrayPath, sub };
  }
  const value = getByPath(canonical, path);
  return { kind: 'scalar', value, ok: value !== undefined, path };
}

function validateMappings(canonical, mappings) {
  const errors = [];
  const results = [];
  const entries = Array.isArray(mappings)
    ? mappings
    : Object.entries(mappings || {}).map(([docxTag, canonicalPath]) => ({ docxTag, canonicalPath }));

  for (const { docxTag, canonicalPath } of entries) {
    if (!docxTag || !docxTag.trim()) {
      errors.push({ tag: docxTag || '(empty)', message: 'Mapping tag is empty' });
      results.push({ docxTag: docxTag || '(empty)', canonicalPath, ok: false, message: 'Mapping tag is empty' });
      continue;
    }
    if (!canonicalPath || !canonicalPath.trim()) {
      errors.push({ tag: docxTag, message: 'No canonical path set' });
      results.push({ docxTag, canonicalPath, ok: false, message: 'No canonical path set' });
      continue;
    }
    const result = resolveMapping(canonical, canonicalPath);
    if (!result.ok) {
      const what =
        result.kind === 'loop'
          ? `"${result.arrayPath}" is not an array in the sample canonical payload`
          : result.kind === 'item'
            ? `"${result.arrayPath}" is not an array or has no "${result.sub}" on its items`
            : `path not found in sample canonical payload`;
      const message = `Invalid path "${canonicalPath}": ${what}`;
      errors.push({ tag: docxTag, message });
      results.push({ docxTag, canonicalPath, ok: false, message });
      continue;
    }
    let sampleValue;
    if (result.kind === 'loop') sampleValue = `${(result.value || []).length} items`;
    else if (result.kind === 'item') {
      const first = result.value && result.value[0];
      const resolved = first != null ? getByPath(first, result.sub) : undefined;
      sampleValue = resolved !== undefined ? String(resolved) : '—';
    } else sampleValue = String(result.value);
    results.push({ docxTag, canonicalPath, ok: true, sampleValue });
  }
  return { valid: errors.length === 0, errors, entries, results };
}

function buildRenderContext(canonical, mappings) {
  const ctx = JSON.parse(JSON.stringify(canonical || {}));
  const entries = Array.isArray(mappings)
    ? mappings
    : Object.entries(mappings || {}).map(([docxTag, canonicalPath]) => ({ docxTag, canonicalPath }));

  for (const { docxTag, canonicalPath } of entries) {
    if (!canonicalPath) continue;
    if (isLoopPath(canonicalPath)) {
      const value = getByPath(canonical, canonicalPath.slice(0, -2));
      setByPath(ctx, docxTag, Array.isArray(value) ? value : []);
      continue;
    }
    if (isItemPath(canonicalPath)) {
      const [arrayPath, ...rest] = canonicalPath.split('[].');
      const sub = rest.join('[].');
      const array = getByPath(canonical, arrayPath);
      const targetArray = getByPath(ctx, arrayPath);
      if (Array.isArray(array) && Array.isArray(targetArray)) {
        const itemKey = docxTag.split('.').pop();
        array.forEach((item, i) => {
          if (!targetArray[i]) return;
          const value = getByPath(item, sub);
          targetArray[i][itemKey] = value;
        });
      }
      continue;
    }
    const value = getByPath(canonical, canonicalPath);
    if (value !== undefined) setByPath(ctx, docxTag, value);
  }
  return ctx;
}

function mappingsFromVariables(variables) {
  const out = {};
  for (const v of variables || []) {
    if (v && v.jsonPath) out[v.name] = v.jsonPath;
  }
  return out;
}

module.exports = { getByPath, setByPath, resolveMapping, validateMappings, buildRenderContext, mappingsFromVariables };
