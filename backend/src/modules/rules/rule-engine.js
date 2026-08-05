const ANSWERS_RE = /\{answers\.([^}]+)\}/g;
const FLAGS_RE = /\{flags\.([^}]+)\}/g;
const ITEM_RE = /\{item\.([^}]+)\}/g;

function setByPath(obj, path, value) {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (cur[parts[i]] == null || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

function getByPath(obj, path) {
  return path.split('.').reduce((cur, p) => (cur == null ? undefined : cur[p]), obj);
}

function matchesWhen(when, answers) {
  if (!when) return false;
  if (when.all) return when.all.every((w) => matchesWhen(w, answers));
  if (when.any) return when.any.some((w) => matchesWhen(w, answers));
  if (when.field !== undefined) {
    const value = answers[when.field];
    if (when.equals !== undefined) return value === when.equals;
    if (when.notEquals !== undefined) return value !== when.notEquals;
    if (when.in) return when.in.includes(value);
    return Boolean(value);
  }
  if (when.group !== undefined) {
    const list = Array.isArray(answers[when.group]) ? answers[when.group] : [];
    if (when.min !== undefined) return list.length >= when.min;
    if (when.max !== undefined) return list.length <= when.max;
    return list.length > 0;
  }
  return false;
}

function substitute(text, answers, flags, extra = {}) {
  let out = String(text);
  out = out.replace(ANSWERS_RE, (_, path) => {
    const v = getByPath(answers, path);
    return v == null ? '' : String(v);
  });
  out = out.replace(FLAGS_RE, (_, path) => {
    const v = getByPath(flags, path);
    return v == null ? 'No' : v ? 'Yes' : 'No';
  });
  out = out.replace(ITEM_RE, (_, path) => {
    const v = getByPath(extra.item, path);
    return v == null ? '' : String(v);
  });
  return out;
}

function validateRuleDefinition(definition) {
  const errors = [];
  if (!definition || typeof definition !== 'object') {
    return { valid: false, errors: ['The rule definition is missing.'] };
  }
  const flagKeys = new Set();

  (definition.flags || []).forEach((f, i) => {
    const ref = f.label ? `Flag "${f.label}"` : `Flag ${i + 1}`;
    if (!f.key) errors.push(`${ref} has no internal key — give it a name.`);
    else if (flagKeys.has(f.key)) errors.push(`"${f.key}" is used by more than one flag — keys must be unique.`);
    else flagKeys.add(f.key);
    if (!f.when) errors.push(`${ref} has no condition — set one or choose "always true".`);
  });

  (definition.computed || []).forEach((c, i) => {
    const ref = c.label ? `Computed "${c.label}"` : `Computed ${i + 1}`;
    if (!c.key) errors.push(`${ref} has no output name.`);
    if (!c.value && !c.template) errors.push(`${ref} is empty — enter the sentence it should produce.`);
  });

  if (definition.includeGroups && !Array.isArray(definition.includeGroups)) {
    errors.push('The included lists must be a list.');
  }

  if (definition.groupMaps && typeof definition.groupMaps !== 'object') {
    errors.push('The list item mapping must be a set of fields, not an array.');
  }

  return { valid: errors.length === 0, errors };
}

function evaluate(definition, answers, context = {}) {
  const flags = {};
  for (const f of definition.flags || []) {
    flags[f.key] = matchesWhen(f.when, answers);
  }
  for (const f of context.additionalFlags || []) {
    if (flags[f.key] === undefined) flags[f.key] = Boolean(f.when ? matchesWhen(f.when, answers) : true);
  }

  const computed = {};
  for (const c of definition.computed || []) {
    const raw = c.template !== undefined ? c.template : c.value;
    const resolved = substitute(raw, answers, flags);
    setByPath(computed, c.key, resolved);
  }

  const canonical = { flags };
  for (const key of Object.keys(computed)) {
    const top = key.split('.')[0];
    if (canonical[top] === undefined) {
      canonical[top] = computed[top];
    }
  }

  const groupMaps = definition.groupMaps || {};
  for (const groupId of definition.includeGroups || []) {
    const list = Array.isArray(answers[groupId]) ? answers[groupId] : [];
    const itemMap = groupMaps[groupId];
    canonical[groupId] = list.map((item) => {
      if (!itemMap) return { ...item };
      const mapped = {};
      for (const [key, template] of Object.entries(itemMap)) {
        mapped[key] = substitute(template, {}, {}, { item });
      }
      return mapped;
    });
  }

  return canonical;
}

module.exports = { evaluate, validateRuleDefinition, matchesWhen, substitute, setByPath };
