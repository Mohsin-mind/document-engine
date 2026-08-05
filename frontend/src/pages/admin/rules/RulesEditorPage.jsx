import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { getRule, updateRule, publishRule, testRule, generateSampleRule } from '../../../api/rules.js';
import { getQuestionSet } from '../../../api/questions.js';
import SampleTree from '../../../components/SampleTree.jsx';
import FieldReference from '../../../components/FieldReference.jsx';

const slugify = (label) =>
  String(label || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .map((w, i) => (i === 0 ? w : w[0]?.toUpperCase() + w.slice(1)))
    .join('');

const titleCase = (s) =>
  String(s || '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

function EqualsWidget({ field, value, onChange }) {
  if (field?.type === 'dropdown') {
    return (
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-gray-300 px-2 py-1 text-xs"
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
        className="rounded border border-gray-300 px-2 py-1 text-xs"
      >
        <option value="">— choose one —</option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
    );
  }
  return (
    <input
      placeholder="value"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      className="w-36 rounded border border-gray-300 px-2 py-1 text-xs"
    />
  );
}

function AdvancedKey({ label, value, onChange }) {
  return (
    <details className="group">
      <summary className="cursor-pointer text-[11px] text-gray-400 hover:text-gray-600">Advanced</summary>
      <label className="mt-1 flex items-center gap-2 text-[11px] text-gray-500">
        <span className="whitespace-nowrap">{label}:</span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-64 rounded border border-gray-300 px-2 py-1 font-mono text-[11px]"
        />
        <span>Used by templates — leave as-is unless you know it is referenced.</span>
      </label>
    </details>
  );
}

function FlagEditor({ flag, fields, groups, onChange, onRemove }) {
  const when = flag.when || {};
  const kind = when.all ? 'all' : when.group ? 'group' : when.field ? 'field' : 'always';
  const label = flag.label || titleCase(flag.key) || '';

  const setLabel = (v) => {
    const next = { ...flag, label: v };
    const derivedOld = slugify(label);
    if (!flag.key || flag.key === derivedOld) next.key = slugify(v);
    onChange(next);
  };
  const setWhen = (w) => onChange({ ...flag, when: w });

  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Flag name (e.g. Spouse included)"
          className="w-56 rounded border border-gray-300 px-2 py-1 text-xs"
        />
        <span className="text-xs text-gray-500">is true when</span>
        <select
          value={kind}
          onChange={(e) => {
            const k = e.target.value;
            if (k === 'always') setWhen(undefined);
            if (k === 'field') setWhen({ field: '', equals: '' });
            if (k === 'group') setWhen({ group: '', min: 1 });
            if (k === 'all') setWhen({ all: [{ field: '', equals: '' }] });
          }}
          className="rounded border border-gray-300 px-2 py-1 text-xs"
        >
          <option value="field">an answer equals</option>
          <option value="group">a list has at least</option>
          <option value="always">always (no condition)</option>
          <option value="all">all of these answers match</option>
        </select>
        {kind === 'field' && (
          <>
            <select
              value={when.field || ''}
              onChange={(e) => setWhen({ ...when, field: e.target.value, equals: when.equals ?? '' })}
              className="w-52 rounded border border-gray-300 px-2 py-1 text-xs"
            >
              <option value="">— choose an answer —</option>
              {fields.map((f) => (
                <option key={f.id} value={f.id}>{f.label}</option>
              ))}
            </select>
            <EqualsWidget
              field={fields.find((f) => f.id === when.field)}
              value={when.equals}
              onChange={(v) => setWhen({ ...when, equals: v })}
            />
          </>
        )}
        {kind === 'group' && (
          <>
            <select
              value={when.group || ''}
              onChange={(e) => setWhen({ ...when, group: e.target.value })}
              className="w-52 rounded border border-gray-300 px-2 py-1 text-xs"
            >
              <option value="">— choose a list —</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.label}</option>
              ))}
            </select>
            <input
              type="number"
              value={when.min ?? 1}
              onChange={(e) => setWhen({ ...when, min: parseInt(e.target.value || '1', 10) })}
              className="w-16 rounded border border-gray-300 px-2 py-1 text-xs"
            />
            <span className="text-xs text-gray-500">items</span>
          </>
        )}
        {kind === 'all' && (
          <div className="w-full space-y-1">
            {(when.all || []).map((w, i) => (
              <div key={i} className="flex items-center gap-2">
                <select
                  value={w.field || ''}
                  onChange={(e) => {
                    const all = [...when.all];
                    all[i] = { ...w, field: e.target.value, equals: w.equals ?? '' };
                    setWhen({ ...when, all });
                  }}
                  className="w-52 rounded border border-gray-300 px-2 py-1 text-xs"
                >
                  <option value="">— choose an answer —</option>
                  {fields.map((f) => (
                    <option key={f.id} value={f.id}>{f.label}</option>
                  ))}
                </select>
                <EqualsWidget
                  field={fields.find((f) => f.id === w.field)}
                  value={w.equals}
                  onChange={(v) => {
                    const all = [...when.all];
                    all[i] = { ...w, equals: v };
                    setWhen({ ...when, all });
                  }}
                />
                <button
                  onClick={() => setWhen({ ...when, all: when.all.filter((_, j) => j !== i) })}
                  className="text-xs text-red-600 hover:underline"
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              onClick={() => setWhen({ ...when, all: [...when.all, { field: '', equals: '' }] })}
              className="rounded-md border border-dashed border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
            >
              + Add condition
            </button>
          </div>
        )}
        <button onClick={onRemove} className="ml-auto text-xs text-red-600 hover:underline">
          Remove
        </button>
      </div>
      <AdvancedKey
        label="Internal key"
        value={flag.key || ''}
        onChange={(key) => onChange({ ...flag, key })}
      />
    </div>
  );
}

function ComputedEditor({ computed, fields, flags, onChange, onRemove }) {
  const label = computed.label || titleCase(computed.key) || '';
  const TOKEN_RE = /\{answers\.[a-z0-9]+\}|\{flags\.[a-z0-9]+\}/g;
  const insert = (token) => {
    if (!token) return;
    const current = computed.template ?? '';
    const existing = current.match(TOKEN_RE);
    onChange({
      ...computed,
      template: existing?.length ? current.replace(existing[0], token) : `${current}${token}`,
    });
  };
  const currentToken = (computed.template ?? '').match(TOKEN_RE)?.[0] || '';
  const currentMeta = currentToken.startsWith('{answers.')
    ? fields.find((f) => `{answers.${f.id}}` === currentToken)
    : flags.find((f) => `{flags.${f.key}}` === currentToken);
  const currentLabel = currentToken
    ? currentMeta
      ? currentToken.startsWith('{answers.')
        ? currentMeta.label
        : `flag: ${currentMeta.label || currentMeta.key}`
      : currentToken
    : '';
  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={label}
          onChange={(e) => {
            const next = { ...computed, label: e.target.value };
            const derivedOld = slugify(label);
            if (!computed.key || computed.key === derivedOld) next.key = slugify(e.target.value);
            onChange(next);
          }}
          placeholder="Output name (e.g. Executor clause)"
          className="w-56 rounded border border-gray-300 px-2 py-1 text-xs"
        />
        <span className="text-xs text-gray-500">=</span>
        <input
          value={computed.template ?? computed.value ?? ''}
          onChange={(e) => onChange({ ...computed, template: e.target.value, value: undefined })}
          placeholder="Sentence, e.g. I appoint … as executor."
          className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs"
        />
        <select
          value={currentToken}
          onChange={(e) => insert(e.target.value)}
          className="rounded border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs text-indigo-700"
        >
          {currentToken && (
            <option value={currentToken}>{currentLabel}</option>
          )}
          <option value="">+ Insert answer…</option>
          {fields
            .filter((f) => `{answers.${f.id}}` !== currentToken)
            .map((f) => (
              <option key={f.id} value={`{answers.${f.id}}`}>{f.label}</option>
            ))}
          {flags
            .filter((f) => `{flags.${f.key}}` !== currentToken)
            .map((f) => (
              <option key={f.key} value={`{flags.${f.key}}`}>flag: {f.label || f.key}</option>
            ))}
        </select>
        <button onClick={onRemove} className="text-xs text-red-600 hover:underline">
          Remove
        </button>
      </div>
      <AdvancedKey
        label="Internal key"
        value={computed.key || ''}
        onChange={(key) => onChange({ ...computed, key })}
      />
    </div>
  );
}

export default function RulesEditorPage() {
  const { id } = useParams();
  const [definition, setDefinition] = useState(null);
  const [status, setStatus] = useState('draft');
  const [answersText, setAnswersText] = useState('{\n  "fullName": "John Smith"\n}');
  const [canonical, setCanonical] = useState(null);
  const [sampleAnswers, setSampleAnswers] = useState(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const { isLoading, isError, error: queryError, data } = useQuery({
    queryKey: ['rule', id],
    queryFn: () => getRule(id),
  });

  const { data: qs } = useQuery({
    queryKey: ['question-set', data?.questionSetId],
    queryFn: () => getQuestionSet(data.questionSetId),
    enabled: Boolean(data?.questionSetId),
  });

  const qsDef = qs?.latestVersion?.definition || qs?.versions?.[0]?.definition;

  const qsFields = useMemo(() => {
    const out = [];
    for (const s of qsDef?.sections || []) {
      for (const q of s.questions || []) {
        out.push({ id: q.id, label: q.label, type: q.type, options: q.options });
      }
      for (const f of s.repeatable?.fields || []) {
        out.push({ id: f.id, label: f.label, type: f.type, options: f.options });
      }
    }
    return out;
  }, [qsDef]);

  const qsGroups = useMemo(
    () =>
      (qsDef?.sections || [])
        .filter((s) => s.repeatable)
        .map((s) => ({
          id: s.repeatable.id,
          label: s.title || s.repeatable.label || s.repeatable.id,
          fields: s.repeatable.fields || [],
        })),
    [qsDef]
  );

  useEffect(() => {
    if (data) {
      setDefinition(data.definition);
      setStatus(data.status);
    }
  }, [data]);

  useEffect(() => {
    setNotice('');
    setError('');
  }, [definition]);

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

  const genSampleMut = useMutation({
    mutationFn: () => generateSampleRule(id),
    onSuccess: (d) => {
      setSampleAnswers(d.answers);
      setCanonical(d.canonical);
      setAnswersText(JSON.stringify(d.answers, null, 2));
      setNotice(
        `Sample submission generated${d.questionSetName ? ` from "${d.questionSetName}"` : ''} and run through the current rules.`
      );
    },
    onError: (e) => setError(`Failed to generate sample: ${e.message}`),
  });

  const testMut = useMutation({
    mutationFn: () => testRule(id, JSON.parse(answersText)),
    onSuccess: (d) => {
      setCanonical(d.canonical);
      setSampleAnswers(null);
      setNotice('Rules evaluated on the sample below');
    },
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
  const setGroups = (groups) => setDefinition({ ...definition, includeGroups: groups });

  const toggleGroup = (groupId) => {
    const list = definition.includeGroups || [];
    setGroups(list.includes(groupId) ? list.filter((g) => g !== groupId) : [...list, groupId]);
  };

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
      {!data?.questionSetId && (
        <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-2 text-sm text-amber-700">
          This rule is not linked to a question set — link one so the editor can offer its answers and lists.
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
        <p className="text-sm font-semibold text-gray-700">Flags (true / false facts)</p>
        <p className="text-xs text-gray-500">
          A flag becomes true when its condition matches. Templates can use it to include or skip a paragraph.
        </p>
        {(definition.flags || []).map((f, i) => (
          <FlagEditor
            key={i}
            flag={f}
            fields={qsFields}
            groups={qsGroups}
            onChange={(u) => setFlags(definition.flags.map((x, j) => (j === i ? u : x)))}
            onRemove={() => setFlags(definition.flags.filter((_, j) => j !== i))}
          />
        ))}
        <button
          onClick={() => setFlags([...(definition.flags || []), { key: '', label: '', when: { field: '', equals: '' } }])}
          className="rounded-md border border-dashed border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
        >
          + Add flag
        </button>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
        <p className="text-sm font-semibold text-gray-700">Computed values (sentences)</p>
        <p className="text-xs text-gray-500">
          A sentence built from answers. Use “Insert answer” instead of typing placeholders.
        </p>
        {(definition.computed || []).map((c, i) => (
          <ComputedEditor
            key={i}
            computed={c}
            fields={qsFields}
            flags={definition.flags || []}
            onChange={(u) => setComputed(definition.computed.map((x, j) => (j === i ? u : x)))}
            onRemove={() => setComputed(definition.computed.filter((_, j) => j !== i))}
          />
        ))}
        <button
          onClick={() => setComputed([...(definition.computed || []), { key: '', label: '', template: '' }])}
          className="rounded-md border border-dashed border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
        >
          + Add computed
        </button>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
        <p className="text-sm font-semibold text-gray-700">Lists to include in the document data</p>
        <p className="text-xs text-gray-500">
          Choose which repeatable lists (children, beneficiaries, …) appear in the output so templates can loop over them.
        </p>
        {qsGroups.length > 0 ? (
          <div className="flex flex-wrap gap-3">
            {qsGroups.map((g) => {
              const checked = (definition.includeGroups || []).includes(g.id);
              return (
                <label key={g.id} className="flex items-center gap-1.5 text-sm">
                  <input type="checkbox" checked={checked} onChange={() => toggleGroup(g.id)} />
                  {g.label}
                </label>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-gray-400">
            The linked question set has no repeatable lists. Add one in the question set editor to see it here.
          </p>
        )}
        <details className="group">
          <summary className="cursor-pointer text-[11px] text-gray-400 hover:text-gray-600">
            Advanced — list keys
          </summary>
          <input
            value={(definition.includeGroups || []).join(', ')}
            onChange={(e) => setGroups(e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1 font-mono text-xs"
            placeholder="children, assets, beneficiaries"
          />
        </details>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
        <p className="text-sm font-semibold text-gray-700">Group item mapping</p>
        <p className="text-xs text-gray-500">
          Add extra fields to each row of a list — the template reads them as <code>list[].field</code>.
        </p>
        {(definition.includeGroups || []).length === 0 && (
          <p className="text-xs text-gray-400">Include a list above to map its rows.</p>
        )}
        {(definition.includeGroups || []).map((groupId) => {
          const group = qsGroups.find((g) => g.id === groupId);
          const maps = definition.groupMaps?.[groupId] || {};
          const update = (next) => {
            const groupMaps = { ...(definition.groupMaps || {}) };
            if (Object.keys(next).length === 0) delete groupMaps[groupId];
            else groupMaps[groupId] = next;
            setDefinition({ ...definition, groupMaps });
          };
          return (
            <div key={groupId} className="rounded-md border border-indigo-100 bg-indigo-50/40 p-3 space-y-2">
              <p className="text-xs font-semibold text-indigo-700">{group ? group.label : groupId} — row fields</p>
              {Object.entries(maps).map(([key, template]) => {
                const ITEM_TOKEN_RE = /\{item\.[a-z0-9]+\}/g;
                const currentToken = String(template || '').match(ITEM_TOKEN_RE)?.[0] || '';
                const currentField = (group?.fields || []).find((f) => `{item.${f.id}}` === currentToken);
                const currentLabel = currentToken
                  ? currentField
                    ? currentField.label
                    : currentToken
                  : '';
                const pick = (token) => {
                  if (!token) return;
                  const existing = String(template || '').match(ITEM_TOKEN_RE);
                  const nextTemplate = existing?.length
                    ? String(template).replace(existing[0], token)
                    : `${template || ''}${token}`;
                  const picked = (group?.fields || []).find((f) => `{item.${f.id}}` === token);
                  const next = { ...maps };
                  const nextKey = !key || key === 'field' ? picked?.label || key : key;
                  delete next[key];
                  next[nextKey] = nextTemplate;
                  update(next);
                };
                return (
                <div key={key} className="flex items-center gap-2">
                  <input
                    value={key}
                    onChange={(e) => {
                      const next = { ...maps };
                      delete next[key];
                      next[e.target.value] = template;
                      update(next);
                    }}
                    placeholder="field name (e.g. fullName)"
                    className="w-48 rounded border border-gray-300 px-2 py-1 text-xs font-mono"
                  />
                  <span className="text-xs text-gray-500">←</span>
                  <select
                    value={currentToken}
                    onChange={(e) => pick(e.target.value)}
                    className="rounded border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs text-indigo-700"
                  >
                    {currentToken && <option value={currentToken}>{currentLabel}</option>}
                    <option value="">+ Insert…</option>
                    {(group?.fields || [])
                      .filter((f) => `{item.${f.id}}` !== currentToken)
                      .map((f) => (
                        <option key={f.id} value={`{item.${f.id}}`}>{f.label}</option>
                      ))}
                  </select>
                  <input
                    value={template}
                    onChange={(e) => update({ ...maps, [key]: e.target.value })}
                    className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs font-mono"
                    placeholder="{item.name}"
                  />
                  <button
                    onClick={() => {
                      const next = { ...maps };
                      delete next[key];
                      update(next);
                    }}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Remove
                  </button>
                </div>
                );
              })}
              <button
                onClick={() => update({ ...maps, '': '' })}
                className="rounded-md border border-dashed border-indigo-300 px-3 py-1 text-xs text-indigo-600 hover:bg-indigo-50"
              >
                + Add row field
              </button>
            </div>
          );
        })}
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

      <FieldReference
        title="Field reference (what each name means)"
        sections={[
          {
            title: qs ? qs.name : 'Answers',
            rows: (qsDef?.sections || []).flatMap((s) => [
              ...(s.repeatable
                ? [{ label: `${s.repeatable.label} (list)`, id: s.repeatable.id, path: `answers.${s.repeatable.id}` }]
                : []),
              ...(s.questions || []).map((q) => ({
                label: q.label || '(no question text)',
                id: q.id,
                path: `answers.${q.id}`,
              })),
              ...(s.repeatable?.fields || []).map((f) => ({
                label: `${s.title || s.repeatable.label} → ${f.label}`,
                id: f.id,
                path: `item.${f.id}`,
              })),
            ]),
          },
          {
            title: 'Flags',
            rows: (definition.flags || []).map((f) => ({
              label: f.label || titleCase(f.key) || '(no name)',
              id: f.key,
              path: f.key ? `flags.${f.key}` : '',
            })),
          },
          {
            title: 'Computed values',
            rows: (definition.computed || []).map((c) => ({
              label: c.label || titleCase(c.key) || '(no name)',
              id: c.key,
              path: c.key || '',
            })),
          },
        ]}
      />

      <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
        <p className="text-sm font-semibold text-gray-700">Test the rules</p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setError('');
              setNotice('');
              genSampleMut.mutate();
            }}
            disabled={genSampleMut.isPending || !data?.questionSetId}
            title={data?.questionSetId ? '' : 'Link a question set to generate a sample'}
            className="rounded-md bg-indigo-700 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600 disabled:opacity-50"
          >
            {genSampleMut.isPending ? 'Generating…' : 'Generate sample submission & run rules'}
          </button>
          {!data?.questionSetId && (
            <span className="text-xs text-amber-600">Link a question set above, then generate.</span>
          )}
        </div>
        {sampleAnswers && <SampleTree value={sampleAnswers} title="Sample answers" />}
        {canonical && (
          <SampleTree
            value={canonical}
            title="Output used by templates"
            rename={Object.fromEntries(qsGroups.map((g) => [g.id, g.label]))}
          />
        )}
        <details className="group">
          <summary className="cursor-pointer text-[11px] text-gray-400 hover:text-gray-600">
            Advanced — edit sample JSON manually and run rules
          </summary>
          <div className="mt-2 space-y-2">
            <textarea
              value={answersText}
              onChange={(e) => setAnswersText(e.target.value)}
              rows={6}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs font-mono"
            />
            <button
              onClick={() => {
                setError('');
                setNotice('');
                try {
                  testMut.mutate();
                } catch (e) {
                  setError(`Invalid JSON: ${e.message}`);
                }
              }}
              disabled={testMut.isPending}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
            >
              {testMut.isPending ? 'Evaluating…' : 'Run rules → canonical JSON'}
            </button>
          </div>
        </details>
      </div>
    </div>
  );
}
