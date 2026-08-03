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

export function validateAnswers(definition, answers) {
  const errors = [];

  for (const section of definition.sections || []) {
    if (section.questions) {
      for (const q of section.questions) {
        validateField(q, answers[q.id], answers, errors, q.id);
      }
    }
    if (section.repeatable) {
      const r = section.repeatable;
      const rows = answers[r.id];
      if (r.min && (!Array.isArray(rows) || rows.length < r.min)) {
        errors.push({ path: r.id, message: `Add at least ${r.min} ${r.label.toLowerCase()}(s)` });
        continue;
      }
      if (!isEmptyValue(rows)) {
        if (!Array.isArray(rows)) {
          errors.push({ path: r.id, message: `${r.label} entries must be a list` });
          continue;
        }
        if (r.max !== undefined && rows.length > r.max) {
          errors.push({ path: r.id, message: `At most ${r.max} ${r.label.toLowerCase()}(s) allowed` });
        }
        rows.forEach((row, ri) => {
          for (const f of r.fields || []) {
            validateField(f, row[f.id], row, errors, `${r.id}[${ri}].${f.id}`);
          }
        });
      }
    }
  }
  return { valid: errors.length === 0, errors };
}
