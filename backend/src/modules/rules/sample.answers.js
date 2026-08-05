function sampleValue(label, type, options, sectionTitle) {
  const l = String(label || '').toLowerCase();
  const sec = String(sectionTitle || '').toLowerCase();
  switch (type) {
    case 'number':
      return 42;
    case 'date':
      return l.includes('birth') ? '1978-04-12' : '2026-08-05';
    case 'dropdown':
      return options && options[0] ? options[0].value ?? options[0] : 'Option 1';
    case 'yesno':
      return 'yes';
    case 'checkbox':
      return true;
    default:
      if (l.includes('name')) {
        if (l.includes('successor 2')) return 'Emily Davis';
        if (l.includes('successor')) return 'Michael Brown';
        if (sec.includes('healthcare') || l.includes('agent')) return 'Sarah Johnson';
        return 'John Smith';
      }
      if (l.includes('phone')) return l.includes('successor 2') ? '(555) 987-6543' : '(555) 123-4567';
      if (l.includes('address')) return '123 Elm Street, Springfield, IL 62701';
      if (l.includes('relationship')) return 'Spouse';
      return 'Sample value';
  }
}

function buildSampleAnswers(definition) {
  const answers = {};
  for (const section of definition.sections || []) {
    if (section.repeatable) {
      answers[section.repeatable.id] = [{}];
      for (const f of section.repeatable.fields || []) {
        answers[section.repeatable.id][0][f.id] = sampleValue(f.label, f.type, f.options, section.title);
      }
    }
    for (const q of section.questions || []) {
      answers[q.id] = sampleValue(q.label, q.type, q.options, section.title);
    }
  }
  return answers;
}

module.exports = { buildSampleAnswers, sampleValue };