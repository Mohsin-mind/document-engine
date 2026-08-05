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
    return { valid: false, errors: ['The question set definition is missing.'] };
  }
  if (!Array.isArray(definition.sections) || definition.sections.length === 0) {
    return { valid: false, errors: ['Add at least one section before saving.'] };
  }

  const seen = new Set();
  const seenAt = new Map();

  const typeName = (t) =>
    ({ text: 'Text', number: 'Number', date: 'Date', dropdown: 'Dropdown', yesno: 'Yes / No', checkbox: 'Checkbox' })[t] || t;

  definition.sections.forEach((section, si) => {
    const sectionRef = section.title ? `Section "${section.title}"` : `Section ${si + 1}`;
    if (!section.id) errors.push(`${sectionRef} is missing an internal id.`);
    if (!section.title) errors.push(`Section ${si + 1} needs a title.`);
    if (!Array.isArray(section.questions)) {
      errors.push(`${sectionRef} has no questions list.`);
      return;
    }

    section.questions.forEach((q, qi) => {
      const ref = q.label ? `Question "${q.label}"` : `${sectionRef}, question ${qi + 1}`;
      if (!q.id) errors.push(`${ref} is missing an internal id.`);
      else if (seen.has(q.id)) errors.push(`"${q.id}" is used more than once — ${
        seenAt.get(q.id) ? `${seenAt.get(q.id)}` : 'another field' } already uses it. Internal ids must be unique.`);
      else {
        seen.add(q.id);
        seenAt.set(q.id, `${ref} (id "${q.id}")`);
      }
      if (!q.label) errors.push(`${ref} needs a question text (the label shown to the customer).`);
      if (!q.type) errors.push(`${ref} has no answer type.`);
      else if (!QUESTION_TYPES.includes(q.type)) {
        errors.push(`${ref} uses an unsupported answer type "${q.type}". Allowed: ${QUESTION_TYPES.map(typeName).join(', ')}.`);
      }
      if ((q.type === 'dropdown' || q.type === 'checkbox') && (!Array.isArray(q.options) || q.options.length === 0)) {
        errors.push(`${ref} is a ${typeName(q.type)} but has no options — add at least one.`);
      }
      if (q.condition) {
        const c = q.condition;
        const hasField = c.field && seen.has(c.field) && c.equals !== undefined;
        const hasGroup = c.group && typeof c.min === 'number';
        if (!hasField && !hasGroup) {
          errors.push(`${ref}: "show only if" must reference an earlier question or list.`);
        }
      }
    });

    if (section.repeatable) {
      const r = section.repeatable;
      const ref = r.label ? `List "${r.label}"` : `${sectionRef}, repeatable list`;
      if (!r.id) errors.push(`${ref} is missing an internal id.`);
      else if (seen.has(r.id)) errors.push(`"${r.id}" is used more than once — ${
        seenAt.get(r.id) ? seenAt.get(r.id) : 'another field' } already uses it. Internal ids must be unique.`);
      else {
        seen.add(r.id);
        seenAt.set(r.id, `${ref} (id "${r.id}")`);
      }
      if (!r.label) errors.push(`${sectionRef}: the repeatable list needs a label (e.g. Children).`);
      if (!Array.isArray(r.fields) || r.fields.length === 0) {
        errors.push(`${ref} must have at least one field.`);
      }
      (r.fields || []).forEach((f, fi) => {
        const fref = f.label ? `Field "${f.label}" in ${ref}` : `field ${fi + 1} in ${ref}`;
        if (!f.id) errors.push(`${fref} is missing an internal id.`);
        else if (seen.has(f.id)) errors.push(`"${f.id}" is used more than once — ${
          seenAt.get(f.id) ? seenAt.get(f.id) : 'another field' } already uses it. Internal ids must be unique.`);
        else {
          seen.add(f.id);
          seenAt.set(f.id, `${fref} (id "${f.id}")`);
        }
        if (!f.label) errors.push(`${fref} needs a label shown for each list row.`);
        if (!f.type) errors.push(`${fref} has no answer type.`);
        else if (!QUESTION_TYPES.includes(f.type)) errors.push(`${fref} uses an unsupported answer type "${f.type}".`);
        if ((f.type === 'dropdown' || f.type === 'checkbox') && (!Array.isArray(f.options) || f.options.length === 0)) {
          errors.push(`${fref} is a ${typeName(f.type)} but has no options — add at least one.`);
        }
      });
    }
  });

  return { valid: errors.length === 0, errors };
}

module.exports = { validateQuestionSetDefinition, QUESTION_TYPES, collectQuestionIds };
