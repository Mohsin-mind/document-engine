import { useEffect, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import {
  getQuestionSet,
  updateQuestionSet,
  publishQuestionSet,
} from '../../../api/questions.js';

const QUESTION_TYPES = ['text', 'number', 'date', 'dropdown', 'yesno', 'checkbox'];

const uid = () => `q${Math.random().toString(36).slice(2, 8)}`;

function FieldEditor({ field, onChange, onRemove, prefix }) {
  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 p-3 space-y-2">
      <div className="grid grid-cols-6 gap-2">
        <div className="col-span-1">
          <label className="text-xs text-gray-500">ID</label>
          <input
            value={field.id}
            onChange={(e) => onChange({ ...field, id: e.target.value })}
            className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1 text-xs"
          />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-gray-500">Label</label>
          <input
            value={field.label}
            onChange={(e) => onChange({ ...field, label: e.target.value })}
            className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1 text-xs"
          />
        </div>
        <div className="col-span-1">
          <label className="text-xs text-gray-500">Type</label>
          <select
            value={field.type}
            onChange={(e) => onChange({ ...field, type: e.target.value, options: undefined })}
            className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1 text-xs"
          >
            {QUESTION_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="col-span-1 flex items-end pb-1">
          <label className="flex items-center gap-1 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={!!field.required}
              onChange={(e) => onChange({ ...field, required: e.target.checked })}
            />
            Required
          </label>
        </div>
        <div className="col-span-1 flex items-end justify-end pb-1">
          <button onClick={onRemove} className="text-xs text-red-600 hover:underline">
            Remove
          </button>
        </div>
      </div>
      {prefix === 'q' && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-gray-500">Condition (when…)</label>
            <div className="flex gap-1 mt-0.5">
              <input
                placeholder="field id"
                value={field.condition?.field || ''}
                onChange={(e) =>
                  onChange({
                    ...field,
                    condition: { ...field.condition, field: e.target.value },
                  })
                }
                className="w-1/2 rounded border border-gray-300 px-2 py-1 text-xs"
              />
              <input
                placeholder="equals value"
                value={field.condition?.equals ?? ''}
                onChange={(e) =>
                  onChange({
                    ...field,
                    condition: { ...field.condition, equals: e.target.value },
                  })
                }
                className="w-1/2 rounded border border-gray-300 px-2 py-1 text-xs"
              />
            </div>
          </div>
          {field.type === 'dropdown' && (
            <div>
              <label className="text-xs text-gray-500">Options (comma separated)</label>
              <input
                value={(field.options || []).join(', ')}
                onChange={(e) =>
                  onChange({
                    ...field,
                    options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                  })
                }
                className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1 text-xs"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SectionEditor({ section, onChange, onRemove, onAddQuestion }) {
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

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2 flex-1">
          <input
            value={section.id}
            onChange={(e) => onChange({ ...section, id: e.target.value })}
            className="w-40 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-mono"
            placeholder="section id"
          />
          <input
            value={section.title}
            onChange={(e) => onChange({ ...section, title: e.target.value })}
            className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            placeholder="Section title"
          />
        </div>
        <div className="flex items-center gap-3 pl-3">
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
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-500 uppercase">Questions</p>
        {(section.questions || []).map((q, i) => (
          <FieldEditor
            key={q._k || q.id}
            prefix="q"
            field={q}
            onChange={(f) => setField(i, f)}
            onRemove={() => removeField(i)}
          />
        ))}
        <button
          onClick={onAddQuestion}
          className="rounded-md border border-dashed border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
        >
          + Add question
        </button>
      </div>

      {rep && (
        <div className="space-y-2 rounded-md border border-indigo-100 bg-indigo-50/50 p-3">
          <p className="text-xs font-semibold text-indigo-700 uppercase">Repeatable: {rep.label}</p>
          <div className="grid grid-cols-4 gap-2">
            <input
              value={rep.id}
              onChange={(e) => setRep({ ...rep, id: e.target.value })}
              className="rounded border border-gray-300 px-2 py-1 text-xs font-mono"
              placeholder="group id"
            />
            <input
              value={rep.label}
              onChange={(e) => setRep({ ...rep, label: e.target.value })}
              className="rounded border border-gray-300 px-2 py-1 text-xs"
              placeholder="label"
            />
            <input
              type="number"
              value={rep.min}
              onChange={(e) => setRep({ ...rep, min: parseInt(e.target.value || '0', 10) })}
              className="rounded border border-gray-300 px-2 py-1 text-xs"
              placeholder="min"
            />
            <input
              type="number"
              value={rep.max}
              onChange={(e) => setRep({ ...rep, max: parseInt(e.target.value || '10', 10) })}
              className="rounded border border-gray-300 px-2 py-1 text-xs"
              placeholder="max"
            />
          </div>
          <div className="space-y-2">
            {rep.fields.map((f, i) => (
              <FieldEditor
                key={f._k || f.id}
                prefix="f"
                field={f}
                onChange={(u) => setRepField(i, u)}
                onRemove={() => setRep({ ...rep, fields: rep.fields.filter((_, j) => j !== i) })}
              />
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
                  { _k: uid(), id: uid(), label: 'Question', type: 'text', required: false },
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
          onClick={() =>
            saveMut.mutate({ name, description, definition })
          }
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
    </div>
  );
}
