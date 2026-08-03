import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { getRule, updateRule, publishRule, testRule } from '../../../api/rules.js';

const emptyWhen = () => ({ field: '', equals: '' });

function FlagEditor({ flag, onChange, onRemove }) {
  const when = flag.when || {};
  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 p-3 flex gap-2 items-center">
      <input
        value={flag.key}
        onChange={(e) => onChange({ ...flag, key: e.target.value })}
        placeholder="flag key (e.g. hasSpouse)"
        className="w-44 rounded border border-gray-300 px-2 py-1 text-xs font-mono"
      />
      <select
        value={when.all ? 'all' : when.group ? 'group' : when.field ? 'field' : 'always'}
        onChange={(e) => {
          const kind = e.target.value;
          if (kind === 'always') onChange({ ...flag, when: undefined });
          if (kind === 'field') onChange({ ...flag, when: { field: '', equals: '' } });
          if (kind === 'group') onChange({ ...flag, when: { group: '', min: 1 } });
          if (kind === 'all') onChange({ ...flag, when: { all: [{ field: '', equals: '' }] } });
        }}
        className="rounded border border-gray-300 px-2 py-1 text-xs"
      >
        <option value="field">field equals</option>
        <option value="group">group min</option>
        <option value="always">always true</option>
        <option value="all">all conditions</option>
      </select>
      {when.field !== undefined && (
        <>
          <input
            value={when.field}
            onChange={(e) => onChange({ ...flag, when: { ...when, field: e.target.value } })}
            placeholder="field id"
            className="w-32 rounded border border-gray-300 px-2 py-1 text-xs font-mono"
          />
          <input
            value={when.equals ?? ''}
            onChange={(e) => onChange({ ...flag, when: { ...when, equals: e.target.value } })}
            placeholder="equals"
            className="w-32 rounded border border-gray-300 px-2 py-1 text-xs"
          />
        </>
      )}
      {when.group !== undefined && (
        <>
          <input
            value={when.group}
            onChange={(e) => onChange({ ...flag, when: { ...when, group: e.target.value } })}
            placeholder="group id"
            className="w-32 rounded border border-gray-300 px-2 py-1 text-xs font-mono"
          />
          <input
            type="number"
            value={when.min ?? 1}
            onChange={(e) => onChange({ ...flag, when: { ...when, min: parseInt(e.target.value || '1', 10) } })}
            className="w-20 rounded border border-gray-300 px-2 py-1 text-xs"
          />
        </>
      )}
      <button onClick={onRemove} className="ml-auto text-xs text-red-600 hover:underline">
        Remove
      </button>
    </div>
  );
}

export default function RulesEditorPage() {
  const { id } = useParams();
  const [definition, setDefinition] = useState(null);
  const [status, setStatus] = useState('draft');
  const [answersText, setAnswersText] = useState('{\n  "fullName": "John Smith"\n}');
  const [testResult, setTestResult] = useState(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const { isLoading, isError, error: queryError, data } = useQuery({
    queryKey: ['rule', id],
    queryFn: () => getRule(id),
  });

  useEffect(() => {
    if (data) {
      setDefinition(data.definition);
      setStatus(data.status);
    }
  }, [data]);

  const saveMut = useMutation({
    mutationFn: (payload) => updateRule(id, payload),
    onSuccess: () => setNotice('Saved as draft'),
    onError: (e) => setError(e.message),
  });

  const publishMut = useMutation({
    mutationFn: () => publishRule(id),
    onSuccess: (data) => {
      setStatus(data.status);
      setNotice('Published');
    },
    onError: (e) => setError(e.message),
  });

  const testMut = useMutation({
    mutationFn: () => testRule(id, JSON.parse(answersText)),
    onSuccess: (data) => setTestResult(data.canonical),
    onError: (e) => setError(`Test failed: ${e.message}`),
  });

  if (isLoading || !definition) return <p className="text-gray-500">Loading…</p>;
  if (isError) {
    return (
      <div className="rounded-md bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
        Failed to load rule: {queryError?.message}
      </div>
    );
  }

  const setFlags = (flags) => setDefinition({ ...definition, flags });
  const setComputed = (computed) => setDefinition({ ...definition, computed });
  const setGroups = (text) =>
    setDefinition({
      ...definition,
      includeGroups: text.split(',').map((s) => s.trim()).filter(Boolean),
    });

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Edit Rules</h2>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            status === 'published' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
          }`}
        >
          {status}
        </span>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">{error}</div>
      )}
      {notice && (
        <div className="rounded-md bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-700">
          {notice}
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
        <p className="text-sm font-semibold text-gray-700">Flags (booleans)</p>
        {(definition.flags || []).map((f, i) => (
          <FlagEditor
            key={i}
            flag={f}
            onChange={(u) => setFlags(definition.flags.map((x, j) => (j === i ? u : x)))}
            onRemove={() => setFlags(definition.flags.filter((_, j) => j !== i))}
          />
        ))}
        <button
          onClick={() => setFlags([...(definition.flags || []), { key: '', when: emptyWhen() }])}
          className="rounded-md border border-dashed border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
        >
          + Add flag
        </button>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
        <p className="text-sm font-semibold text-gray-700">Computed values</p>
        <p className="text-xs text-gray-500">
          Templates support {'{answers.field}'} and {'{flags.flag}'}. Keys may be dotted (e.g.{' '}
          customer.fullName, computed.executorClause).
        </p>
        {(definition.computed || []).map((c, i) => (
          <div key={i} className="rounded-md border border-gray-200 bg-gray-50 p-3 flex gap-2">
            <input
              value={c.key}
              onChange={(e) =>
                setComputed(definition.computed.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)))
              }
              placeholder="key (e.g. customer.fullName)"
              className="w-52 rounded border border-gray-300 px-2 py-1 text-xs font-mono"
            />
            <input
              value={c.template ?? c.value ?? ''}
              onChange={(e) =>
                setComputed(
                  definition.computed.map((x, j) =>
                    j === i ? { ...x, template: e.target.value, value: undefined } : x
                  )
                )
              }
              placeholder={'template, e.g. I appoint {answers.executorName} as executor.'}
              className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs"
            />
            <button
              onClick={() => setComputed(definition.computed.filter((_, j) => j !== i))}
              className="text-xs text-red-600 hover:underline"
            >
              Remove
            </button>
          </div>
        ))}
        <button
          onClick={() =>
            setComputed([...(definition.computed || []), { key: '', template: '' }])
          }
          className="rounded-md border border-dashed border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
        >
          + Add computed
        </button>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <label className="block text-sm font-semibold text-gray-700">
          Include answer groups in canonical output
        </label>
        <input
          value={(definition.includeGroups || []).join(', ')}
          onChange={(e) => setGroups(e.target.value)}
          placeholder="children, assets, beneficiaries"
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono"
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => saveMut.mutate({ definition })}
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
        <p className="text-sm font-semibold text-gray-700 mb-2">Test sandbox</p>
        <textarea
          value={answersText}
          onChange={(e) => setAnswersText(e.target.value)}
          rows={6}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs font-mono"
        />
        <div className="mt-2">
          <button
            onClick={() => {
              setError('');
              setTestResult(null);
              testMut.mutate();
            }}
            disabled={testMut.isPending}
            className="rounded-md bg-indigo-700 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600 disabled:opacity-50"
          >
            {testMut.isPending ? 'Evaluating…' : 'Run rules → Canonical JSON'}
          </button>
        </div>
        {testResult && (
          <pre className="mt-3 rounded-md bg-slate-900 p-3 text-xs text-green-300 overflow-auto">
            {JSON.stringify(testResult, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
