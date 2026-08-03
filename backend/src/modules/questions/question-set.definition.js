const QUESTION_TYPES = ['text', 'number', 'date', 'dropdown', 'yesno', 'checkbox'];

function collectQuestionIds(definition) {
  const ids = [];
  for (const section of definition.sections || []) {
    if (section.repeatable) {
      for (const f of section.repeatable.fields || []) {
        ids.push(f.id);
      }
    }
    for (const q of section.questions || []) {
      ids.push(q.id);
    }
  }
  return ids;
}

function validateQuestionSetDefinition(definition) {
  const errors = [];

  if (!definition || typeof definition !== 'object') {
    return { valid: false, errors: ['definition must be an object'] };
  }
  if (!Array.isArray(definition.sections) || definition.sections.length === 0) {
    return { valid: false, errors: ['definition.sections must be a non-empty array'] };
  }

  const seen = new Set();

  definition.sections.forEach((section, si) => {
    if (!section.id) errors.push(`sections[${si}]: missing id`);
    if (!section.title) errors.push(`sections[${si}]: missing title`);
    if (!Array.isArray(section.questions)) {
      errors.push(`sections[${si}]: questions must be an array`);
      return;
    }

    section.questions.forEach((q, qi) => {
      const loc = `sections[${si}].questions[${qi}]`;
      if (!q.id) errors.push(`${loc}: missing id`);
      else if (seen.has(q.id)) errors.push(`${loc}: duplicate id "${q.id}"`);
      else seen.add(q.id);
      if (!q.label) errors.push(`${loc}: missing label`);
      if (!q.type) errors.push(`${loc}: missing type`);
      else if (!QUESTION_TYPES.includes(q.type)) {
        errors.push(`${loc}: invalid type "${q.type}" (allowed: ${QUESTION_TYPES.join(', ')})`);
      }
      if (q.type === 'dropdown' && (!Array.isArray(q.options) || q.options.length === 0)) {
        errors.push(`${loc}: dropdown requires non-empty options`);
      }
      if (q.condition) {
        const c = q.condition;
        const hasField = c.field && seen.has(c.field) && c.equals !== undefined;
        const hasGroup = c.group && typeof c.min === 'number';
        if (!hasField && !hasGroup) {
          errors.push(`${loc}: condition must reference an earlier field (field+equals) or group (group+min)`);
        }
      }
    });

    if (section.repeatable) {
      const r = section.repeatable;
      const loc = `sections[${si}].repeatable`;
      if (!r.id) errors.push(`${loc}: missing id`);
      else if (seen.has(r.id)) errors.push(`${loc}: duplicate id "${r.id}"`);
      else seen.add(r.id);
      if (!r.label) errors.push(`${loc}: missing label`);
      if (!Array.isArray(r.fields) || r.fields.length === 0) {
        errors.push(`${loc}: fields must be a non-empty array`);
      }
      (r.fields || []).forEach((f, fi) => {
        const floc = `${loc}.fields[${fi}]`;
        if (!f.id) errors.push(`${floc}: missing id`);
        else if (seen.has(f.id)) errors.push(`${floc}: duplicate id "${f.id}"`);
        else seen.add(f.id);
        if (!f.label) errors.push(`${floc}: missing label`);
        if (!f.type) errors.push(`${floc}: missing type`);
        else if (!QUESTION_TYPES.includes(f.type)) errors.push(`${floc}: invalid type "${f.type}"`);
      });
    }
  });

  return { valid: errors.length === 0, errors };
}

module.exports = { validateQuestionSetDefinition, QUESTION_TYPES, collectQuestionIds };
