const CHILD_NAMES = ['Amy Smith', 'Ben Carter', 'Chloe Nguyen', 'David Okafor'];
const CHILD_DATES = ['2010-05-01', '2009-11-15', '2008-03-22', '2007-07-08'];

function sampleValue(label, type, options, sectionTitle, index = 0) {
  const l = String(label || '').toLowerCase();
  const sec = String(sectionTitle || '').toLowerCase();
  switch (type) {
    case 'number':
      return 42;
    case 'date':
      if (l.includes('child') || sec.includes('child')) return CHILD_DATES[index] ?? '2010-05-01';
      return l.includes('birth') ? '1978-04-12' : '2026-08-05';
    case 'dropdown':
      return options && options[0] ? options[0].value ?? options[0] : 'Option 1';
    case 'yesno':
      return 'yes';
    case 'checkbox':
      return true;
    default:
      if (l.includes('disinherited')) return 'No one';
      if (l.includes('trust') && !l.includes('trustee')) return 'The John Smith Living Trust';
      if (l.includes('state')) return 'Texas';
      if (l.includes('guardian')) return 'Jane Doe';
      if (l.includes('charity')) return l.includes('2') ? 'Greenleaf Foundation' : 'Local Humane Society';
      if (l.includes('beneficiar')) return l.includes('2') ? 'Liam Smith' : 'Olivia Smith';
      if (l.includes('name') || l.includes('trustee')) {
        if (l.includes('successor 2') || l.includes('second')) return 'Emily Davis';
        if (l.includes('successor')) return 'Michael Brown';
        if (l.includes('child') || sec.includes('child')) return CHILD_NAMES[index] ?? 'Amy Smith';
        if (l.includes('alternate')) return 'Robert Brown';
        if (sec.includes('spouse') || l.includes('spouse')) return 'Sarah Johnson';
        if (sec.includes('healthcare') || l.includes('agent')) return 'Sarah Johnson';
        return 'John Smith';
      }
      if (l.includes('phone')) return l.includes('successor 2') ? '(555) 987-6543' : '(555) 123-4567';
      if (l.includes('address')) return '123 Elm Street, Springfield, IL 62701';
      if (l.includes('relationship')) return 'Spouse';
      return index > 0 ? `Sample value ${index + 1}` : 'Sample value';
  }
}

function buildSampleAnswers(definition) {
  const answers = {};
  for (const section of definition.sections || []) {
    if (section.repeatable) {
      const count = /child/i.test(section.title) ? 4 : 1;
      answers[section.repeatable.id] = Array.from({ length: count }, (_, i) => {
        const entry = {};
        for (const f of section.repeatable.fields || []) {
          entry[f.id] = sampleValue(f.label, f.type, f.options, section.title, i);
        }
        return entry;
      });
    }
    for (const q of section.questions || []) {
      if (q.type === 'repeatable') {
        const count = /child|children/i.test(q.label) ? 4 : 1;
        answers[q.id] = Array.from({ length: count }, (_, i) => {
          const entry = {};
          for (const f of q.fields || []) {
            entry[f.id] = sampleValue(f.label, f.type, f.options, q.label, i);
          }
          return entry;
        });
      } else {
        answers[q.id] = sampleValue(q.label, q.type, q.options, section.title);
      }
    }
  }
  return answers;
}

module.exports = { buildSampleAnswers, sampleValue };