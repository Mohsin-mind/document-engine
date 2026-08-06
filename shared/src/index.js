export function isEmptyValue(value) {
  return value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);
}

export function conditionMatches(condition, answers) {
  if (!condition) return true;
  if (condition.field !== undefined) {
    return String(answers[condition.field] ?? '') === String(condition.equals);
  }
  if (condition.group !== undefined) {
    const rows = answers[condition.group];
    return Array.isArray(rows) && rows.length >= (condition.min ?? 1);
  }
  return true;
}

function validateField(field, value, answers, errors, path) {
  const label = path || field.id;
  if (field.condition && !conditionMatches(field.condition, answers)) return;

  if (field.required && isEmptyValue(value)) {
    errors.push({ path, message: `${label} is required` });
    return;
  }
  if (isEmptyValue(value)) return;

  const validation = field.validation || {};
  const stringValue = String(value).trim();

  if (field.type === 'number') {
    const num = typeof value === 'number' ? value : Number(value);
    if (Number.isNaN(num)) {
      errors.push({ path, message: `${label} must be a number` });
      return;
    }
    if (validation.min !== undefined && num < validation.min) {
      errors.push({ path, message: `${label} must be at least ${validation.min}` });
    }
    if (validation.max !== undefined && num > validation.max) {
      errors.push({ path, message: `${label} must be at most ${validation.max}` });
    }
    return;
  }

  if (field.type === 'dropdown' && Array.isArray(field.options)) {
    if (!field.options.map((o) => String(o)).includes(stringValue)) {
      errors.push({ path, message: `${label} must be one of: ${field.options.join(', ')}` });
      return;
    }
  }

  if (field.type === 'checkbox' && !Array.isArray(value)) {
    errors.push({ path, message: `${label} must be a list of selected options` });
    return;
  }

  if (field.type === 'date') {
    if (Number.isNaN(Date.parse(stringValue))) {
      errors.push({ path, message: `${label} must be a valid date` });
      return;
    }
  }

  if (validation.minLength !== undefined && stringValue.length < validation.minLength) {
    errors.push({ path, message: `${label} must be at least ${validation.minLength} characters` });
  }
  if (validation.maxLength !== undefined && stringValue.length > validation.maxLength) {
    errors.push({ path, message: `${label} must be at most ${validation.maxLength} characters` });
  }
  if (validation.pattern) {
    try {
      if (!new RegExp(validation.pattern).test(stringValue)) {
        errors.push({ path, message: `${label} does not match the required format` });
      }
    } catch (e) {
      errors.push({ path, message: `${label} has an invalid pattern` });
    }
  }
}

function validateRepeatable(list, rows, answers, errors) {
  if (list.condition && !conditionMatches(list.condition, answers)) return;
  if (list.min && (!Array.isArray(rows) || rows.length < list.min)) {
    errors.push({ path: list.id, message: `Add at least ${list.min} ${list.label.toLowerCase()}(s)` });
    return;
  }
  if (isEmptyValue(rows)) return;
  if (!Array.isArray(rows)) {
    errors.push({ path: list.id, message: `${list.label} entries must be a list` });
    return;
  }
  if (list.max !== undefined && rows.length > list.max) {
    errors.push({ path: list.id, message: `At most ${list.max} ${list.label.toLowerCase()}(s) allowed` });
  }
  rows.forEach((row, ri) => {
    for (const f of list.fields || []) {
      validateField(f, row[f.id], row, errors, `${list.id}[${ri}].${f.id}`);
    }
  });
}

export function validateAnswers(definition, answers) {
  const errors = [];

  for (const section of definition.sections || []) {
    if (section.questions) {
      for (const q of section.questions) {
        if (q.type === 'repeatable') {
          validateRepeatable(q, answers[q.id], answers, errors);
        } else {
          validateField(q, answers[q.id], answers, errors, q.id);
        }
      }
    }
    if (section.repeatable) {
      validateRepeatable(section.repeatable, answers[section.repeatable.id], answers, errors);
    }
  }
  return { valid: errors.length === 0, errors };
}
