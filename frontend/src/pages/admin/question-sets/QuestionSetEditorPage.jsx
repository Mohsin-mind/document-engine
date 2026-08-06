import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import {
  getQuestionSet,
  updateQuestionSet,
  publishQuestionSet,
} from '../../../api/questions.js';
import FieldReference from '../../../components/FieldReference.jsx';
import Collapsible from '../../../components/Collapsible.jsx';
import { PageScaffold, Button, Alert, StatusBadge, Input, Select, Loading } from '../../../components/ui';

const uid = () => `q${Math.random().toString(36).slice(2, 8)}`;

function slugify(label) {
  return (
    String(label || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9\s]/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((w, i) => (i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)))
      .join('') || 'key'
  );
}

function uniqueId(base, taken) {
  const root = slugify(base);
  if (!taken.has(root)) return root;
  let n = 2;
  while (taken.has(`${root}${n}`)) n += 1;
  return `${root}${n}`;
}

function relabeled(obj, label, takenIds) {
  const next = { ...obj, label };
  if (obj._auto && String(label).trim()) {
    const taken = new Set(takenIds);
    taken.delete(obj.id);
    next.id = uniqueId(label, taken);
  }
  return next;
}

function stripClientMeta(definition) {
  const clean = { ...definition, sections: (definition.sections || []).map((s) => {
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
  })};
  return clean;
}

const TYPE_META = {
  text: { label: 'Text', hint: 'Short free-text answer (name, address, …)' },
  number: { label: 'Number', hint: 'Numeric value (age, amount, …)' },
  date: { label: 'Date', hint: 'Date picker (e.g. 15 Jan 2026)' },
  dropdown: { label: 'Dropdown', hint: 'Choose one from a list of options' },
  yesno: { label: 'Yes / No', hint: 'Two buttons — yes or no' },
  checkbox: { label: 'Checkbox', hint: 'Single tick box (e.g. “I have a will”)' },
};

const ROW_TYPE_META = {
  ...TYPE_META,
  repeatable: { label: 'Repeatable', hint: 'A list the customer can add rows to' },
};

function EqualsWidget({ field, value, onChange, placeholder }) {
  if (field?.type === 'dropdown') {
    return (
      <Select size="sm" className="w-full" value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">— choose one —</option>
        {(field.options || []).map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </Select>
    );
  }
  if (field?.type === 'yesno') {
    return (
      <Select size="sm" className="w-full" value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">— choose one —</option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </Select>
    );
  }
  return (
    <Input
      size="sm"
      className="w-full"
      placeholder={placeholder || 'equals value'}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function AdvancedId({ value, onChange, editable }) {
  return (
    <details className="group">
      <summary className="cursor-pointer text-[11px] text-gray-400 hover:text-gray-600">
        Advanced
      </summary>
      <div className="mt-1 flex items-center gap-2 text-[11px] text-gray-500">
        <span>Internal key:</span>
        {editable ? (
          <>
            <Input
              size="sm"
              className="w-56 font-mono"
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              placeholder="key"
            />
            <span>Used by rules and templates — locked after the first publish.</span>
          </>
        ) : (
          <>
            <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[11px]">{value}</code>
            <span>Used by rules and templates — locked after publish.</span>
          </>
        )}
      </div>
    </details>
  );
}

function OptionsEditor({ options, onChange }) {
  const set = (i, v) => {
    const next = [...options];
    next[i] = v;
    onChange(next);
  };
  return (
    <div className="space-y-1">
      <p className="text-[11px] text-gray-500">Options (shown to the customer as a list to pick from):</p>
      {options.map((o, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            size="sm"
            className="flex-1"
            value={o}
            onChange={(e) => set(i, e.target.value)}
            placeholder={`Option ${i + 1}`}
          />
          <Button variant="link" className="text-red-600" onClick={() => onChange(options.filter((_, j) => j !== i))}>
            Remove
          </Button>
        </div>
      ))}
      <Button variant="dashed" size="xxs" onClick={() => onChange([...options, ''])}>
        + Add option
      </Button>
    </div>
  );
}

function FieldEditor({ field, onChange, onRemove, prefix, priorFields, takenIds, editable }) {
  const meta = TYPE_META[field.type] || { label: field.type, hint: '' };
  const condField = priorFields.find((f) => f.id === field.condition?.field);
  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 p-3 space-y-2">
      <div className="grid grid-cols-6 gap-2 items-start">
        <div className="col-span-3">
          <label className="text-xs text-gray-500">Question</label>
          <Input
            size="field"
            className="mt-0.5 w-full"
            value={field.label}
            onChange={(e) => onChange(relabeled(field, e.target.value, takenIds))}
            placeholder="e.g. Full legal name"
          />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-gray-500">Answer type</label>
          <Select
            size="sm"
            className="mt-0.5 w-full"
            value={field.type}
            onChange={(e) => onChange({ ...field, type: e.target.value, options: undefined })}
          >
            {Object.entries(TYPE_META).map(([value, t]) => (
              <option key={value} value={value}>{t.label}</option>
            ))}
          </Select>
          <p className="mt-0.5 text-[11px] text-gray-400">{meta.hint}</p>
        </div>
        <div className="col-span-1 flex flex-col items-end gap-2 pt-5">
          <label className="flex items-center gap-1 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={!!field.required}
              onChange={(e) => onChange({ ...field, required: e.target.checked })}
            />
            Required
          </label>
          <Button variant="link" className="text-red-600" onClick={onRemove}>
            Remove
          </Button>
        </div>
      </div>

      {prefix === 'q' && priorFields.length > 0 && (
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 whitespace-nowrap">Show only if</label>
          <Select
            size="sm"
            className="w-56"
            value={field.condition?.field ?? ''}
            onChange={(e) =>
              onChange({
                ...field,
                condition: e.target.value
                  ? { field: e.target.value, equals: field.condition?.equals ?? '' }
                  : undefined,
              })
            }
          >
            <option value="">— always show —</option>
            {priorFields.map((f) => (
              <option key={f.id} value={f.id}>{f.label}</option>
            ))}
          </Select>
          {field.condition?.field && (
            <>
              <span className="text-xs text-gray-500">equals</span>
              <div className="w-40">
                <EqualsWidget
                  field={condField}
                  value={field.condition?.equals}
                  onChange={(v) =>
                    onChange({ ...field, condition: { ...field.condition, equals: v } })
                  }
                />
              </div>
              {String(field.condition?.equals ?? '').trim() === '' && (
                <span className="text-xs text-amber-600">Choose a triggering value (e.g. Yes) — an empty value shows the question only when the trigger is unanswered.</span>
              )}
            </>
          )}
        </div>
      )}

      {field.type === 'dropdown' && (
        <OptionsEditor
          options={field.options || []}
          onChange={(opts) => onChange({ ...field, options: opts })}
        />
      )}

      <AdvancedId
        value={field.id}
        editable={editable}
        onChange={(v) => onChange({ ...field, id: v, _auto: false })}
      />
    </div>
  );
}

function QuestionRow({ question, open, onToggle, priorFields, children }) {
  const meta = ROW_TYPE_META[question.type] || { label: question.type, hint: '' };
  const condField = question.condition?.field
    ? priorFields.find((f) => f.id === question.condition.field)
    : null;
  return (
    <Collapsible
      open={open}
      onToggle={onToggle}
      className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2"
      contentClassName="pt-2"
      header={
        <>
          <span className="min-w-0 truncate text-sm text-gray-800">
            {question.label || '(no question text)'}
          </span>
          <span className="shrink-0 rounded bg-indigo-100 px-1.5 py-0.5 text-[11px] text-indigo-700">
            {meta.label}
          </span>
          {question.required && (
            <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-700">
              Required
            </span>
          )}
          {condField && (
            <span className="shrink-0 rounded bg-gray-200 px-1.5 py-0.5 text-[11px] text-gray-600">
              only if {condField.label} = {question.condition.equals}
            </span>
          )}
        </>
      }
    >
      {children}
    </Collapsible>
  );
}

function RepeatableEditor({ item, onChange, onRemove, priorFields, takenIds, editable }) {
  const condField = priorFields.find((f) => f.id === item.condition?.field);
  const setField = (index, updated) => {
    const fields = [...item.fields];
    fields[index] = updated;
    onChange({ ...item, fields });
  };
  return (
    <div className="rounded-md border border-indigo-100 bg-indigo-50/40 p-3 space-y-2">
      <div className="grid grid-cols-6 gap-2 items-start">
        <div className="col-span-3">
          <label className="text-xs text-gray-500">List label</label>
          <Input
            size="field"
            className="mt-0.5 w-full"
            value={item.label}
            onChange={(e) => onChange(relabeled(item, e.target.value, takenIds))}
            placeholder="e.g. Children"
          />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-gray-500">Add-row button label</label>
          <Input
            size="field"
            className="mt-0.5 w-full"
            value={item.addLabel || ''}
            onChange={(e) => onChange({ ...item, addLabel: e.target.value })}
            placeholder="e.g. Add child"
          />
        </div>
        <div className="col-span-1 flex items-end justify-end pb-0.5">
          <Button variant="link" className="text-red-600" onClick={onRemove}>
            Remove
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3 text-[11px] text-gray-500">
        <span>min rows</span>
        <Input
          size="sm"
          type="number"
          className="w-16"
          value={item.min}
          onChange={(e) => onChange({ ...item, min: parseInt(e.target.value || '0', 10) })}
        />
        <span>max rows</span>
        <Input
          size="sm"
          type="number"
          className="w-16"
          value={item.max}
          onChange={(e) => onChange({ ...item, max: parseInt(e.target.value || '10', 10) })}
        />
      </div>

      {priorFields.length > 0 && (
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 whitespace-nowrap">Show only if</label>
          <Select
            size="sm"
            className="w-56"
            value={item.condition?.field ?? ''}
            onChange={(e) =>
              onChange({
                ...item,
                condition: e.target.value
                  ? { field: e.target.value, equals: item.condition?.equals ?? '' }
                  : undefined,
              })
            }
          >
            <option value="">— always show —</option>
            {priorFields.map((f) => (
              <option key={f.id} value={f.id}>{f.label}</option>
            ))}
          </Select>
          {item.condition?.field && (
            <>
              <span className="text-xs text-gray-500">equals</span>
              <div className="w-40">
                <EqualsWidget
                  field={condField}
                  value={item.condition?.equals}
                  onChange={(v) => onChange({ ...item, condition: { ...item.condition, equals: v } })}
                />
              </div>
              {String(item.condition?.equals ?? '').trim() === '' && (
                <span className="text-xs text-amber-600">Choose a triggering value (e.g. Yes) — an empty value shows the list only when the question is unanswered.</span>
              )}
            </>
          )}
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs font-semibold text-indigo-700 uppercase">Row fields</p>
        {item.fields.map((f, i) => (
          <div key={f._k || f.id} className="rounded-md border border-indigo-100 bg-white p-2 space-y-2">
            <div className="grid grid-cols-6 gap-2 items-start">
              <div className="col-span-3">
                <label className="text-xs text-gray-500">Field label</label>
                <Input
                  size="sm"
                  className="mt-0.5 w-full"
                  value={f.label}
                  onChange={(e) => setField(i, relabeled(f, e.target.value, takenIds))}
                  placeholder="e.g. Full name"
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-gray-500">Answer type</label>
                <Select
                  size="sm"
                  className="mt-0.5 w-full"
                  value={f.type}
                  onChange={(e) => setField(i, { ...f, type: e.target.value, options: undefined })}
                >
                  {Object.entries(TYPE_META).map(([value, t]) => (
                    <option key={value} value={value}>{t.label}</option>
                  ))}
                </Select>
              </div>
              <div className="col-span-1 flex flex-col items-end gap-2 pt-5">
                <label className="flex items-center gap-1 text-xs text-gray-600">
                  <input
                    type="checkbox"
                    checked={!!f.required}
                    onChange={(e) => setField(i, { ...f, required: e.target.checked })}
                  />
                  Required
                </label>
                <Button
                  variant="link"
                  className="text-red-600"
                  onClick={() => onChange({ ...item, fields: item.fields.filter((_, j) => j !== i) })}
                >
                  Remove
                </Button>
              </div>
            </div>
            {f.type === 'dropdown' && (
              <OptionsEditor
                options={f.options || []}
                onChange={(opts) => setField(i, { ...f, options: opts })}
              />
            )}
            <AdvancedId
              value={f.id}
              editable={editable}
              onChange={(v) => setField(i, { ...f, id: v, _auto: false })}
            />
          </div>
        ))}
        <Button
          variant="dashedIndigo"
          size="xs"
          onClick={() => {
            const taken = new Set(takenIds);
            taken.delete(item.id);
            onChange({
              ...item,
              fields: [...item.fields, { _auto: true, id: uniqueId('Field', taken), label: 'Field', type: 'text', required: false }],
            });
          }}
        >
          + Add field
        </Button>
        <AdvancedId
          value={item.id}
          editable={editable}
          onChange={(v) => onChange({ ...item, id: v, _auto: false })}
        />
      </div>
    </div>
  );
}

function SectionEditor({ section, onChange, onRemove, onAddQuestion, onAddList, priorFields, takenIds, locked }) {
  const [openQ, setOpenQ] = useState(null);
  const prevCount = useRef((section.questions || []).length);
  useEffect(() => {
    const n = (section.questions || []).length;
    if (n > prevCount.current) setOpenQ(n - 1);
    prevCount.current = n;
  }, [section.questions]);
  const setField = (index, updated) => {
    const questions = [...section.questions];
    questions[index] = updated;
    onChange({ ...section, questions });
  };
  const removeField = (index) => {
    onChange({ ...section, questions: section.questions.filter((_, i) => i !== index) });
  };

  const priorBeforeSection = priorFields;
  const questionPrior = (i) => [
    ...priorBeforeSection,
    ...(section.questions || []).slice(0, i).map((q) => ({
      id: q.id,
      label: q.label,
      type: q.type,
      options: q.options,
    })),
  ];

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-4">
      <div className="flex items-center gap-3">
        <Input
          size="md"
          value={section.title}
          onChange={(e) => onChange({ ...section, title: e.target.value })}
          className="flex-1 font-medium"
          placeholder="Section title (e.g. Grantor details)"
        />
        <Button variant="link" className="text-sm text-red-600" onClick={onRemove}>
          Remove section
        </Button>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-500 uppercase">
          Questions ({(section.questions || []).length})
        </p>
        {(section.questions || []).map((q, i) => (
          <QuestionRow
            key={q._k || q.id}
            question={q}
            open={openQ === i}
            onToggle={() => setOpenQ(openQ === i ? null : i)}
            priorFields={questionPrior(i)}
          >
            {q.type === 'repeatable' ? (
              <RepeatableEditor
                item={q}
                priorFields={questionPrior(i)}
                takenIds={takenIds}
                editable={!locked}
                onChange={(f) => setField(i, f)}
                onRemove={() => removeField(i)}
              />
            ) : (
              <FieldEditor
                prefix="q"
                field={q}
                priorFields={questionPrior(i)}
                takenIds={takenIds}
                editable={!locked}
                onChange={(f) => setField(i, f)}
                onRemove={() => removeField(i)}
              />
            )}
          </QuestionRow>
        ))}
        <div className="flex gap-2">
          <Button variant="dashed" size="sm" onClick={onAddQuestion}>
            + Add question
          </Button>
          <Button variant="dashedIndigo" size="sm" onClick={onAddList}>
            + Add list (repeatable)
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function QuestionSetEditorPage() {
  const { id } = useParams();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [definition, setDefinition] = useState(null);
  const [versions, setVersions] = useState([]);
  const [status, setStatus] = useState('draft');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const { isLoading, isError, error: queryError, data } = useQuery({
    queryKey: ['question-set', id],
    queryFn: () => getQuestionSet(id),
  });

  useEffect(() => {
    if (data) {
      const latest = data.latestVersion || data.versions?.[0] || null;
      const def = latest?.definition;
      const sections = (def?.sections || []).map((s) => {
        const questions = [...(s.questions || [])];
        if (s.repeatable) {
          questions.push({
            _k: uid(),
            id: s.repeatable.id,
            type: 'repeatable',
            label: s.repeatable.label || 'List',
            addLabel: s.repeatable.addLabel,
            min: s.repeatable.min ?? 0,
            max: s.repeatable.max ?? 10,
            fields: s.repeatable.fields || [],
          });
        }
        return { ...s, questions };
      });
      setName(data.name);
      setDescription(data.description || '');
      setDefinition(def ? { ...def, sections } : null);
      setVersions(data.versions || []);
      setStatus(data.status);
    }
  }, [data]);

  useEffect(() => {
    setNotice('');
    setError('');
  }, [definition, name]);

  const saveMut = useMutation({
    mutationFn: (payload) => updateQuestionSet(id, payload),
    onSuccess: (data) => {
      setVersions(data.versions);
      setStatus(data.status);
      setNotice('Saved as draft');
    },
    onError: (e) => setError(e.message),
  });

  const publishMut = useMutation({
    mutationFn: () => publishQuestionSet(id),
    onSuccess: (data) => {
      setVersions(data.versions);
      setStatus(data.status);
      setNotice('Published');
    },
    onError: (e) => setError(e.message),
  });

  const takenIds = useMemo(() => {
    const set = new Set();
    for (const s of definition?.sections || []) {
      for (const q of s.questions || []) {
        if (q.id) set.add(q.id);
        for (const f of q.fields || []) if (f.id) set.add(f.id);
      }
      for (const f of s.repeatable?.fields || []) if (f.id) set.add(f.id);
      if (s.repeatable?.id) set.add(s.repeatable.id);
    }
    return set;
  }, [definition]);

  const locked = useMemo(() => versions.some((v) => v.status === 'published'), [versions]);

  if (isLoading || !definition) return <Loading />;
  if (isError) {
    return <Alert variant="error">Failed to load question set: {queryError?.message}</Alert>;
  }

  const setSection = (index, section) => {
    const sections = [...definition.sections];
    sections[index] = section;
    setDefinition({ ...definition, sections });
  };

  const priorFieldsFor = (sectionIndex) => {
    const out = [];
    definition.sections.forEach((section, si) => {
      if (si >= sectionIndex) return;
      (section.questions || []).forEach((q) => {
        if (q.type === 'repeatable') {
          (q.fields || []).forEach((f) =>
            out.push({ id: f.id, label: f.label, type: f.type, options: f.options })
          );
        } else {
          out.push({ id: q.id, label: q.label, type: q.type, options: q.options });
        }
      });
      if (section.repeatable) {
        (section.repeatable.fields || []).forEach((f) =>
          out.push({ id: f.id, label: f.label, type: f.type, options: f.options })
        );
      }
    });
    return out;
  };

  const handleSave = () =>
    saveMut.mutate({ name, description, definition: stripClientMeta(definition) });

  return (
    <PageScaffold
      title="Edit Question Set"
      actions={
        <>
          <StatusBadge status={status} size="md" />
          <Button onClick={handleSave} disabled={saveMut.isPending} size="lg">
            {saveMut.isPending ? 'Saving…' : 'Save Draft'}
          </Button>
          <Button variant="success" onClick={() => publishMut.mutate()} disabled={publishMut.isPending} size="lg">
            {publishMut.isPending ? 'Publishing…' : 'Publish'}
          </Button>
        </>
      }
    >

      {error && <Alert variant="error">{error}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}

      <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700">Name</label>
            <Input size="md" className="mt-1 w-full" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <Input size="md" className="mt-1 w-full" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {definition.sections.map((section, i) => (
          <SectionEditor
            key={section.id || i}
            section={section}
            priorFields={priorFieldsFor(i)}
            takenIds={takenIds}
            locked={locked}
            onChange={(s) => setSection(i, s)}
            onRemove={() => {
              const sections = definition.sections.filter((_, j) => j !== i);
              setDefinition({ ...definition, sections });
            }}
            onAddQuestion={() => {
              const sections = [...definition.sections];
              sections[i] = {
                ...section,
                questions: [
                  ...(section.questions || []),
                  { _k: uid(), _auto: true, id: uniqueId('New question', takenIds), label: 'New question', type: 'text', required: false },
                ],
              };
              setDefinition({ ...definition, sections });
            }}
            onAddList={() => {
              const sections = [...definition.sections];
              const listId = uniqueId('New list', takenIds);
              const fieldTaken = new Set(takenIds);
              fieldTaken.add(listId);
              sections[i] = {
                ...section,
                questions: [
                  ...(section.questions || []),
                  {
                    _k: uid(),
                    _auto: true,
                    id: listId,
                    type: 'repeatable',
                    label: 'New list',
                    addLabel: 'Add item',
                    min: 0,
                    max: 10,
                    fields: [{ _auto: true, id: uniqueId('Name', fieldTaken), label: 'Name', type: 'text', required: false }],
                  },
                ],
              };
              setDefinition({ ...definition, sections });
            }}
          />
        ))}
        <Button
          variant="dashed"
          size="md"
          onClick={() =>
            setDefinition({
              ...definition,
              sections: [
                ...definition.sections,
                { id: uid(), title: 'New Section', questions: [] },
              ],
            })
          }
        >
          + Add section
        </Button>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <p className="text-sm font-semibold text-gray-700 mb-2">Version History</p>
        <ul className="divide-y divide-gray-100 text-sm">
          {versions.map((v) => (
            <li key={v.id} className="py-2 flex items-center justify-between">
              <span>
                v{v.versionNo} · {v.status}
              </span>
              <span className="text-xs text-gray-400">
                {v.publishedAt ? `published ${new Date(v.publishedAt).toLocaleString()}` : 'draft'}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <FieldReference
        title="Field reference (labels → internal ids)"
        sections={definition.sections.map((s) => ({
          title: s.title || s.id,
          rows: [
            ...(s.repeatable
              ? [{ label: `${s.repeatable.label} (list)`, id: s.repeatable.id, path: `answers.${s.repeatable.id}` }]
              : []),
            ...(s.questions || []).filter((q) => q.type === 'repeatable').map((q) => ({
              label: `${q.label} (list)`,
              id: q.id,
              path: `answers.${q.id}`,
            })),
            ...(s.questions || []).filter((q) => q.type !== 'repeatable').map((q) => ({
              label: q.label || '(no question text)',
              id: q.id,
              path: `answers.${q.id}`,
              extra: q.type === 'dropdown' ? `${(q.options || []).length} options` : undefined,
            })),
          ],
        }))}
      />
    </PageScaffold>
  );
}
