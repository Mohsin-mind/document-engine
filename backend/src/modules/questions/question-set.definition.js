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
      if (q.type === 'repeatable') {
        ids.push(q.id);
        for (const f of q.fields || []) {
          ids.push(f.id);
        }
      } else {
        ids.push(q.id);
      }
    }
  }
  return ids;
}

function validateCondition(condition, seen, errors, ref) {
  if (!condition) return;
  const c = condition;
  const hasField = c.field !== undefined && c.field !== null && c.field !== '';
  const hasGroup = c.group !== undefined && c.group !== null && c.group !== '';
  if (hasField) {
    if (!seen.has(c.field)) {
      errors.push(`${ref}: "show only if" must reference an earlier question or list.`);
      return;
    }
    if (String(c.equals ?? '').trim() === '') {
      errors.push(
        `${ref}: "show only if" needs a triggering value — the field is set but no value was chosen (e.g. Yes for a Yes/No question).`
      );
    }
    return;
  }
  if (hasGroup) {
    if (typeof c.min !== 'number') {
      errors.push(`${ref}: "show only if" for a list needs a minimum row count.`);
    }
  }
}

function validateRepeatable(list, seen, seenAt, errors, ref) {
  if (!list.id) errors.push(`${ref} is missing an internal id.`);
  else if (seen.has(list.id)) errors.push(`"${list.id}" is used more than once — ${
    seenAt.get(list.id) ? seenAt.get(list.id) : 'another field' } already uses it. Internal ids must be unique.`);
  else {
    seen.add(list.id);
    seenAt.set(list.id, `${ref} (id "${list.id}")`);
  }
  if (!list.label) errors.push(`${ref} needs a label (e.g. Children).`);
  if (!Array.isArray(list.fields) || list.fields.length === 0) {
    errors.push(`${ref} must have at least one field.`);
  }
  (list.fields || []).forEach((f, fi) => {
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

const typeName = (t) =>
  ({ text: 'Text', number: 'Number', date: 'Date', dropdown: 'Dropdown', yesno: 'Yes / No', checkbox: 'Checkbox' })[t] || t;

function stripClientMeta(definition) {
  const cleanSection = (s) => {
    const sc = { ...s };
    delete sc._k;
    delete sc._auto;
    sc.questions = (s.questions || []).map((q) => {
      const qc = { ...q };
      delete qc._k;
      delete qc._auto;
      if (Array.isArray(qc.fields)) {
        qc.fields = qc.fields.map((f) => {
          const fc = { ...f };
          delete fc._k;
          delete fc._auto;
          return fc;
        });
      }
      return qc;
    });
    if (s.repeatable) {
      const rc = { ...s.repeatable };
      delete rc._k;
      delete rc._auto;
      rc.fields = (rc.fields || []).map((f) => {
        const fc = { ...f };
        delete fc._k;
        delete fc._auto;
        return fc;
      });
      sc.repeatable = rc;
    } else {
      delete sc.repeatable;
    }
    return sc;
  };
  return { ...definition, sections: (definition.sections || []).map(cleanSection) };
}

function missingKeys(publishedDefinition, nextDefinition) {
  const published = new Set(collectQuestionIds(publishedDefinition || {}));
  const next = new Set(collectQuestionIds(nextDefinition || {}));
  return [...published].filter((id) => !next.has(id));
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

  definition.sections.forEach((section, si) => {
    const sectionRef = section.title ? `Section "${section.title}"` : `Section ${si + 1}`;
    if (!section.id) errors.push(`${sectionRef} is missing an internal id.`);
    if (!section.title) errors.push(`Section ${si + 1} needs a title.`);
    if (!Array.isArray(section.questions)) {
      errors.push(`${sectionRef} has no questions list.`);
      return;
    }
    if (section.repeatable && section.questions.length > 0) {
      errors.push(
        `${sectionRef} is a repeatable list but also has ${section.questions.length} question(s). A repeatable section only shows the list — remove the regular questions or uncheck "Repeatable group".`
      );
    }

    let repeatableCount = 0;
    section.questions.forEach((q, qi) => {
      const ref = q.label ? `Question "${q.label}"` : `${sectionRef}, question ${qi + 1}`;
      if (q.type === 'repeatable') {
        repeatableCount += 1;
        validateRepeatable(q, seen, seenAt, errors, ref);
        validateCondition(q.condition, seen, errors, ref);
        return;
      }
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
      validateCondition(q.condition, seen, errors, ref);
    });
    if (repeatableCount > 1) {
      errors.push(`${sectionRef} can have only one repeatable list.`);
    }

    if (section.repeatable) {
      validateRepeatable(
        section.repeatable,
        seen,
        seenAt,
        errors,
        section.repeatable.label ? `List "${section.repeatable.label}"` : `${sectionRef}, repeatable list`
      );
    }
  });

  return { valid: errors.length === 0, errors };
}

module.exports = {
  validateQuestionSetDefinition,
  QUESTION_TYPES,
  collectQuestionIds,
  stripClientMeta,
  missingKeys,
};