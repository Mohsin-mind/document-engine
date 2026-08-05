import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import {
  getQuestionSet,
  updateQuestionSet,
  publishQuestionSet,
} from '../../../api/questions.js';
import FieldReference from '../../../components/FieldReference.jsx';
import Collapsible from '../../../components/Collapsible.jsx';

const uid = () => `q${Math.random().toString(36).slice(2, 8)}`;

const TYPE_META = {
  text: { label: 'Text', hint: 'Short free-text answer (name, address, …)' },
  number: { label: 'Number', hint: 'Numeric value (age, amount, …)' },
  date: { label: 'Date', hint: 'Date picker (e.g. 15 Jan 2026)' },
  dropdown: { label: 'Dropdown', hint: 'Choose one from a list of options' },
  yesno: { label: 'Yes / No', hint: 'Two buttons — yes or no' },
  checkbox: { label: 'Checkbox', hint: 'Single tick box (e.g. “I have a will”)' },
};

function EqualsWidget({ field, value, onChange, placeholder }) {
  if (field?.type === 'dropdown') {
    return (
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
      >
        <option value="">— choose one —</option>
        {(field.options || []).map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    );
  }
  if (field?.type === 'yesno') {
    return (
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
      >
        <option value="">— choose one —</option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
    );
  }
  return (
    <input
      placeholder={placeholder || 'equals value'}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
    />
  );
}

function AdvancedId({ id }) {
  return (
    <details className="group">
      <summary className="cursor-pointer text-[11px] text-gray-400 hover:text-gray-600">
        Advanced
      </summary>
      <div className="mt-1 flex items-center gap-2 text-[11px] text-gray-500">
        <span>Internal ID:</span>
        <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[11px]">{id}</code>
        <span>Used by rules and templates — not editable.</span>
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
          <input
            value={o}
            onChange={(e) => set(i, e.target.value)}
            className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs"
            placeholder={`Option ${i + 1}`}
          />
          <button
            onClick={() => onChange(options.filter((_, j) => j !== i))}
            className="text-xs text-red-600 hover:underline"
          >
            Remove
          </button>
        </div>
      ))}
      <button
        onClick={() => onChange([...options, ''])}
        className="rounded-md border border-dashed border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
      >
        + Add option
      </button>
    </div>
  );
}

function FieldEditor({ field, onChange, onRemove, prefix, priorFields }) {
  const meta = TYPE_META[field.type] || { label: field.type, hint: '' };
  const condField = priorFields.find((f) => f.id === field.condition?.field);
  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 p-3 space-y-2">
      <div className="grid grid-cols-6 gap-2 items-start">
        <div className="col-span-3">
          <label className="text-xs text-gray-500">Question</label>
          <input
            value={field.label}
            onChange={(e) => onChange({ ...field, label: e.target.value })}
            className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1 text-sm"
            placeholder="e.g. Full legal name"
          />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-gray-500">Answer type</label>
          <select
            value={field.type}
            onChange={(e) => onChange({ ...field, type: e.target.value, options: undefined })}
            className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1 text-xs"
          >
            {Object.entries(TYPE_META).map(([value, t]) => (
              <option key={value} value={value}>{t.label}</option>
            ))}
          </select>
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
          <button onClick={onRemove} className="text-xs text-red-600 hover:underline">
            Remove
          </button>
        </div>
      </div>

      {prefix === 'q' && priorFields.length > 0 && (
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 whitespace-nowrap">Show only if</label>
          <select
            value={field.condition?.field ?? ''}
            onChange={(e) =>
              onChange({
                ...field,
                condition: e.target.value
                  ? { field: e.target.value, equals: field.condition?.equals ?? '' }
                  : undefined,
              })
            }
            className="w-56 rounded border border-gray-300 px-2 py-1 text-xs"
          >
            <option value="">— always show —</option>
            {priorFields.map((f) => (
              <option key={f.id} value={f.id}>{f.label}</option>
            ))}
          </select>
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

      <AdvancedId id={field.id} />
    </div>
  );
}

function QuestionRow({ question, open, onToggle, priorFields, children }) {
  const meta = TYPE_META[question.type] || { label: question.type, hint: '' };
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

function SectionEditor({ section, onChange, onRemove, onAddQuestion, priorFields }) {
  const [openQ, setOpenQ] = useState(null);
  const [repOpen, setRepOpen] = useState(false);
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

  const rep = section.repeatable;
  const setRep = (updated) => onChange({ ...section, repeatable: updated });
  const setRepField = (index, updated) => {
    const fields = [...rep.fields];
    fields[index] = updated;
    setRep({ ...rep, fields });
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
        <input
          value={section.title}
          onChange={(e) => onChange({ ...section, title: e.target.value })}
          className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium"
          placeholder="Section title (e.g. Grantor details)"
        />
        <label className="flex items-center gap-1 text-xs text-gray-600">
          <input
            type="checkbox"
            checked={!!rep}
            onChange={(e) => {
              if (e.target.checked) {
                setRep({
                  id: uid(),
                  label: 'Item',
                  addLabel: 'Add item',
                  min: 0,
                  max: 10,
                  fields: [{ id: uid(), label: 'Name', type: 'text', required: true }],
                });
              } else {
                setRep(undefined);
              }
            }}
          />
          Repeatable group
        </label>
        <button onClick={onRemove} className="text-sm text-red-600 hover:underline">
          Remove section
        </button>
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
            <FieldEditor
              prefix="q"
              field={q}
              priorFields={questionPrior(i)}
              onChange={(f) => setField(i, f)}
              onRemove={() => removeField(i)}
            />
          </QuestionRow>
        ))}
        <button
          onClick={onAddQuestion}
          className="rounded-md border border-dashed border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
        >
          + Add question
        </button>
      </div>

      {rep && (
        <div className="rounded-md border border-indigo-100 bg-indigo-50/50 p-3">
          <Collapsible
            open={repOpen}
            onToggle={() => setRepOpen(!repOpen)}
            header={
              <>
                <span className="text-xs font-semibold text-indigo-700 uppercase">
                  Repeatable list
                </span>
                <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[11px] text-indigo-700">
                  {rep.label}
                </span>
              </>
            }
          >
            <div className="mt-2 space-y-2">
              <div className="flex items-center gap-2">
                <label className="text-[11px] text-gray-500 whitespace-nowrap">List label</label>
                <input
                  value={rep.label}
                  onChange={(e) => setRep({ ...rep, label: e.target.value })}
                  className="w-48 rounded border border-gray-300 px-2 py-1 text-xs"
                  placeholder="list label (e.g. Children)"
                />
            <div className="ml-auto flex items-center gap-2 text-[11px] text-gray-500">
              <span>min</span>
              <input
                type="number"
                value={rep.min}
                onChange={(e) => setRep({ ...rep, min: parseInt(e.target.value || '0', 10) })}
                className="w-14 rounded border border-gray-300 px-2 py-1 text-xs"
              />
              <span>max</span>
              <input
                type="number"
                value={rep.max}
                onChange={(e) => setRep({ ...rep, max: parseInt(e.target.value || '10', 10) })}
                className="w-14 rounded border border-gray-300 px-2 py-1 text-xs"
              />
            </div>
            <AdvancedId id={rep.id} />
          </div>
          <div className="space-y-2">
            {rep.fields.map((f, i) => (
              <div key={f._k || f.id} className="rounded-md border border-indigo-100 bg-white p-2 space-y-2">
                <div className="grid grid-cols-6 gap-2 items-start">
                  <div className="col-span-3">
                    <input
                      value={f.label}
                      onChange={(e) => setRepField(i, { ...f, label: e.target.value })}
                      className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
                      placeholder="field label (e.g. Full name)"
                    />
                  </div>
                  <div className="col-span-2">
                    <select
                      value={f.type}
                      onChange={(e) => setRepField(i, { ...f, type: e.target.value, options: undefined })}
                      className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
                    >
                      {Object.entries(TYPE_META).map(([value, t]) => (
                        <option key={value} value={value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <button
                      onClick={() => setRep({ ...rep, fields: rep.fields.filter((_, j) => j !== i) })}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                </div>
                {f.type === 'dropdown' && (
                  <OptionsEditor
                    options={f.options || []}
                    onChange={(opts) => setRepField(i, { ...f, options: opts })}
                  />
                )}
                <AdvancedId id={f.id} />
              </div>
            ))}
            <button
              onClick={() =>
                setRep({
                  ...rep,
                  fields: [
                    ...rep.fields,
                    { id: uid(), label: 'Field', type: 'text', required: false },
                  ],
                })
              }
              className="rounded-md border border-dashed border-indigo-300 px-3 py-1 text-xs text-indigo-600 hover:bg-indigo-50"
            >
              + Add field
            </button>
          </div>
        </div>
        </Collapsible>
      </div>
      )}
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
      const sections = (def?.sections || []).map((s) => ({
        ...s,
        questions: s.questions || [],
        repeatable: s.repeatable
          ? { ...s.repeatable, fields: s.repeatable.fields || [] }
          : undefined,
      }));
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

  if (isLoading || !definition) return <p className="text-gray-500">Loading…</p>;
  if (isError) {
    return (
      <div className="rounded-md bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
        Failed to load question set: {queryError?.message}
      </div>
    );
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
      (section.questions || []).forEach((q) =>
        out.push({ id: q.id, label: q.label, type: q.type, options: q.options })
      );
      if (section.repeatable) {
        (section.repeatable.fields || []).forEach((f) =>
          out.push({ id: f.id, label: f.label, type: f.type, options: f.options })
        );
      }
    });
    return out;
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Edit Question Set</h2>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            status === 'published' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
          }`}
        >
          {status}
        </span>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-md bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-700">
          {notice}
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {definition.sections.map((section, i) => (
          <SectionEditor
            key={section.id || i}
            section={section}
            priorFields={priorFieldsFor(i)}
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
                  { _k: uid(), id: uid(), label: 'New question', type: 'text', required: false },
                ],
              };
              setDefinition({ ...definition, sections });
            }}
          />
        ))}
        <button
          onClick={() =>
            setDefinition({
              ...definition,
              sections: [
                ...definition.sections,
                { id: uid(), title: 'New Section', questions: [] },
              ],
            })
          }
          className="rounded-md border border-dashed border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
        >
          + Add section
        </button>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => saveMut.mutate({ name, description, definition })}
          disabled={saveMut.isPending}
          className="rounded-md bg-slate-900 px-5 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {saveMut.isPending ? 'Saving…' : 'Save Draft'}
        </button>
        <button
          onClick={() => publishMut.mutate()}
          disabled={publishMut.isPending}
          className="rounded-md bg-green-700 px-5 py-2 text-sm font-medium text-white hover:bg-green-600 disabled:opacity-50"
        >
          {publishMut.isPending ? 'Publishing…' : 'Publish'}
        </button>
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
            ...(s.questions || []).map((q) => ({
              label: q.label || '(no question text)',
              id: q.id,
              path: `answers.${q.id}`,
              extra: q.type === 'dropdown' ? `${(q.options || []).length} options` : undefined,
            })),
          ],
        }))}
      />
    </div>
  );
}
