import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getTemplate,
  saveMappings,
  runRenderTest,
  publishTemplate,
  generateSampleCanonical,
  updateTemplate,
  createDraftVersion,
} from '../../../api/templates.js';
import { listQuestionSets, getQuestionSet } from '../../../api/questions.js';
import PathSelect from './PathSelect.jsx';
import FieldReference, { flattenValues } from '../../../components/FieldReference.jsx';
import { PageScaffold, Button, Alert, Badge, Textarea, Loading } from '../../../components/ui';

const fileUrl = (key) => (key ? `/api/files/${encodeURIComponent(key)}` : null);

const ALIASES = {
  dob: ['dob', 'date of birth', 'dateofbirth', 'birthdate', 'birth date'],
  name: ['name', 'full name', 'fullname', 'legal name'],
  phone: ['phone', 'phone number', 'telephone', 'number'],
  addr: ['address', 'addr', 'street'],
  rel: ['relationship', 'relation', 'relative'],
  date: ['date', 'day', 'year', 'month'],
  state: ['state'],
  city: ['city'],
};

function norm(s) {
  return s
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_\-]/g, ' ')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function suggest(paths, tag, type) {
  const normTag = norm(tag);
  const tagTokens = normTag.split(' ');
  let best = null;

  for (const path of paths) {
    const isArrayPath = path.includes('[]');
    if (type === 'loop' && !isArrayPath) continue;
    if (type !== 'loop' && isArrayPath) continue;

    const normPath = norm(path);
    const leaf = normPath.split('.').pop().replace('[]', '');
    let score = 0;

    if (normTag === normPath || normTag === leaf) score = 1;
    else if (normPath.includes(normTag) || normTag.includes(leaf)) score = 0.7;
    else {
      const pathTokens = leaf.split(' ');
      const overlap = tagTokens.filter((t) => pathTokens.includes(t)).length;
      if (overlap > 0) score = Math.min(0.65, 0.5 + 0.05 * overlap);
      const firstSeg = normPath.split('.')[0];
      if (tagTokens[0] && firstSeg === tagTokens[0]) score = Math.max(score, 0.6);
      for (const variants of Object.values(ALIASES)) {
        if (tagTokens.some((t) => variants.includes(t)) && variants.includes(leaf)) {
          score = Math.max(score, 0.8);
        }
      }
    }
    if (score > 0 && (!best || score > best.score || (score === best.score && path.length < best.path.length))) {
      best = { path, score };
    }
  }
  if (!best) return null;
  return { path: best.path, confidence: best.score >= 0.7 ? 'high' : best.score >= 0.4 ? 'medium' : 'low' };
}

const CONF_STYLE = {
  high: 'bg-emerald-100 text-emerald-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-gray-100 text-gray-500',
};

export default function TemplateEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [mappings, setMappings] = useState(null);
  const [sampleText, setSampleText] = useState('');
  const [paths, setPaths] = useState([]);
  const [genInfo, setGenInfo] = useState(null);
  const [suggestions, setSuggestions] = useState({});
  const [editedTags, setEditedTags] = useState({});
  const [validation, setValidation] = useState(null);
  const [savedOk, setSavedOk] = useState(false);
  const [mappingDirty, setMappingDirty] = useState(false);
  const [testPassed, setTestPassed] = useState(false);
  const [boundQsId, setBoundQsId] = useState(null);
  const [sampleJsonOpen, setSampleJsonOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const { data: template, isLoading, isError, error: queryError } = useQuery({
    queryKey: ['template', id],
    queryFn: () => getTemplate(id),
  });

  const { data: questionSets } = useQuery({
    queryKey: ['question-sets'],
    queryFn: listQuestionSets,
  });

  const { data: boundQs } = useQuery({
    queryKey: ['question-set', boundQsId],
    queryFn: () => getQuestionSet(boundQsId),
    enabled: Boolean(boundQsId),
  });

  const rename = useMemo(() => {
    const def = boundQs?.latestVersion?.definition;
    const out = {};
    const listFields = {};
    for (const s of def?.sections || []) {
      for (const q of s.questions || []) {
        out[q.id] = q.label || s.title || q.id;
        if (q.type === 'repeatable') {
          listFields[q.id] = Object.fromEntries((q.fields || []).map((f) => [f.id, f.label || f.id]));
        }
      }
      if (s.repeatable) {
        out[s.repeatable.id] = s.title || s.repeatable.label || s.repeatable.id;
        listFields[s.repeatable.id] = Object.fromEntries(
          (s.repeatable.fields || []).map((f) => [f.id, f.label || f.id])
        );
      }
    }
    return { out, listFields };
  }, [boundQs]);

  const displayPath = (p) => p.replace(/^([^.]+)/, (m) => rename.out[m] || m);

  const bindMut = useMutation({
    mutationFn: (questionSetId) => updateTemplate(id, { questionSetId }),
    onSuccess: (_updated, questionSetId) => {
      setBoundQsId(questionSetId || null);
      setNotice(questionSetId ? 'Question set bound to template' : 'Question set unbound');
    },
    onError: (e) => setError(e.message),
  });

  useEffect(() => {
    if (template) {
      const v = template.versions[0];
      if (!mappings && v) {
        const next = {};
        for (const variable of v.extractedVariables) {
          next[variable.name] = variable.jsonPath ?? '';
        }
        setMappings(next);
      }
      if (v?.definition?.questionSetId && !boundQsId) {
        setBoundQsId(v.definition.questionSetId);
      }
    }
  }, [template, mappings]);

  useEffect(() => {
    if (template && paths.length > 0) {
      const v = template.versions[0];
      const next = { ...suggestions };
      for (const variable of v.extractedVariables) {
        if (variable.jsonPath || next[variable.name] || editedTags[variable.name]) continue;
        const s = suggest(paths, variable.name, variable.type);
        if (s) {
          next[variable.name] = s;
          if (s.confidence === 'high') {
            setMappings((m) => (m && !m[variable.name] ? { ...m, [variable.name]: s.path } : m));
          }
        }
      }
      setSuggestions(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paths, template]);

  const variables = useMemo(() => template?.versions[0]?.extractedVariables || [], [template]);
  const v = template?.versions[0];

  const sampleCanonical = useMemo(() => {
    try {
      return JSON.parse(sampleText);
    } catch {
      return null;
    }
  }, [sampleText]);
  const sampleOk = Boolean(sampleCanonical && typeof sampleCanonical === 'object');

  const saveMut = useMutation({
    mutationFn: (vId) => saveMappings(id, vId, { mappings, sampleCanonical: JSON.parse(sampleText) }),
    onSuccess: (saved) => {
      setValidation(saved.validation || null);
      const ok = (saved.validation || []).length > 0 && saved.validation.every((r) => r.ok);
      setSavedOk(ok);
      setMappingDirty(false);
      setNotice(ok ? 'Mappings saved and validated' : 'Mappings saved with warnings');
    },
    onError: (e) => setError(e.message),
  });

  const testMut = useMutation({
    mutationFn: (vId) => runRenderTest(id, vId, JSON.parse(sampleText)),
    onSuccess: () => {
      setTestPassed(true);
      setNotice('Render test completed');
    },
    onError: (e) => setError(`Test failed: ${e.message}`),
  });

  const publishMut = useMutation({
    mutationFn: (vId) => publishTemplate(id, vId),
    onSuccess: () => {
      setNotice('Template published — redirecting to templates…');
      setTimeout(() => navigate('/admin/templates'), 1200);
    },
    onError: (e) => setError(e.message),
  });

  const newVersionMut = useMutation({
    mutationFn: () => createDraftVersion(id),
    onSuccess: (version) => {
      setNotice(`Draft v${version.versionNo} created from published v${v.versionNo} — mappings carried over.`);
      setStep(0);
      setSavedOk(false);
      setTestPassed(false);
      queryClient.invalidateQueries({ queryKey: ['template', id] });
    },
    onError: (e) => setError(e.message),
  });

  const genMut = useMutation({
    mutationFn: () => generateSampleCanonical(id),
    onSuccess: (data) => {
      setPaths(data.paths || []);
      setGenInfo(data);
      setSampleText(JSON.stringify(data.canonical, null, 2));
      setSampleJsonOpen(true);
      setNotice(
        data.questionSetName
          ? `Sample generated from "${data.questionSetName}" (rule v${data.ruleVersionNo})`
          : 'Sample generated from published rule'
      );
    },
    onError: (e) => setError(e.message),
  });

  const parseSample = () => {
    try {
      const parsed = JSON.parse(sampleText);
      setError('');
      return parsed;
    } catch (e) {
      setError(`Sample canonical JSON is invalid: ${e.message}`);
      return null;
    }
  };

  if (isLoading || !template) return <Loading />;
  if (isError) {
    return (
      <Alert variant="error">
        Failed to load template: {queryError?.message}
      </Alert>
    );
  }
  if (!v) return <Loading>No version</Loading>;

  const mappedCount = variables.filter((x) => x.jsonPath || mappings?.[x.name]).length;
  const mappingGate = savedOk || (v.mappingStatus === 'mapped-validated' && !mappingDirty);
  const testGate = testPassed || (v.docxTestStatus === 'passed' && v.pdfTestStatus === 'passed');

  const stepMeta = [
    { label: '1. Sample canonical', gate: sampleOk },
    { label: '2. Mapping', gate: mappingGate },
    { label: '3. Render test', gate: testGate },
    { label: '4. Publish', gate: null },
  ];

  const setPath = (tag, path, fromSuggestion) => {
    setMappings({ ...mappings, [tag]: path });
    if (!fromSuggestion) setEditedTags({ ...editedTags, [tag]: true });
    setValidation(null);
    setSavedOk(false);
    setMappingDirty(true);
  };

  return (
    <PageScaffold
      containerClassName="max-w-5xl"
      title={template.name}
      subtitle={`v${v.versionNo} · ${v.status}`}
      actions={
        <a
          href={fileUrl(`templates/${template.id}/v${v.versionNo}/source.docx`)}
          download="source.docx"
          className="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
        >
          Source DOCX
        </a>
      }
      toolbar={
        <>
          {error && <Alert variant="error" className="mb-2">{error}</Alert>}
          {notice && <Alert variant="success" className="mb-2">{notice}</Alert>}
          <ol className="flex flex-wrap gap-2">
            {stepMeta.map((s, i) => (
              <li key={s.label} className="flex items-center gap-2 text-xs">
                <button
                  onClick={() => i < step && setStep(i)}
                  className={`rounded-full px-2.5 py-1 ${
                    s.gate
                      ? 'bg-green-100 text-green-700'
                      : i === step
                        ? 'bg-slate-900 text-white'
                        : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {s.label}
                </button>
                {i < stepMeta.length - 1 && <span className="text-gray-300">→</span>}
              </li>
            ))}
          </ol>
        </>
      }
    >

      {step === 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-700">Sample canonical payload</p>
          <p className="text-xs text-gray-500">
            Bind a question set, then generate the sample from its published rule — or paste it manually. Mapping
            paths and the render test use this payload.
          </p>
          <div className="flex items-end gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Question set (required)</label>
              <select
                value={boundQsId ?? ''}
                onChange={(e) => bindMut.mutate(e.target.value || null)}
                disabled={bindMut.isPending}
                className="rounded border border-gray-300 px-2 py-1.5 text-xs"
              >
                <option value="">— none —</option>
                {(questionSets || []).map((qs) => (
                  <option key={qs.id} value={qs.id}>
                    {qs.name} ({qs.status})
                  </option>
                ))}
              </select>
            </div>
            <Button
              onClick={() => {
                setNotice('');
                genMut.mutate();
              }}
              disabled={!boundQsId || genMut.isPending}
              title={boundQsId ? '' : 'Bind a question set first'}
            >
              {genMut.isPending ? 'Generating…' : 'Generate sample from rules'}
            </Button>
            {!boundQsId && (
              <span className="text-xs text-amber-600">Bind a question set above, then generate.</span>
            )}
            {genInfo?.questionSetName && (
              <span className="text-xs text-gray-500">
                {genInfo.questionSetName} · rule v{genInfo.ruleVersionNo} · {paths.length} canonical paths
              </span>
            )}
          </div>
          <details open={sampleJsonOpen} onToggle={(e) => setSampleJsonOpen(e.target.open)} className="group">
            <summary className="cursor-pointer text-xs font-medium text-gray-500 hover:text-gray-700">
              Advanced — sample JSON (rarely needs editing; the tree in step 2 is built from it)
            </summary>
            <Textarea
              size="sm"
              className="mt-2 w-full font-mono text-xs"
              rows={10}
              value={sampleText}
              onChange={(e) => setSampleText(e.target.value)}
            />
          </details>
          <div className="flex justify-end">
            <Button onClick={() => sampleOk && setStep(1)} disabled={!sampleOk}>
              Next: mapping →
            </Button>
          </div>
          <FieldReference
            title="Field reference (canonical paths → sample values)"
            sections={[
              {
                title: 'Canonical payload',
                rows: sampleCanonical
                  ? flattenValues(sampleCanonical).map((r) => ({
                      label: displayPath(r.path),
                      id: r.path,
                      path: r.path,
                      extra: String(r.value).slice(0, 40),
                    }))
                  : [],
              },
            ]}
          />
        </div>
      )}

      {step === 1 && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700">
              Mapping — template tag → canonical path{' '}
              <span className="font-normal text-gray-400">
                ({mappedCount} of {variables.length} mapped)
              </span>
            </p>
            <div className="flex flex-wrap gap-1.5 justify-end max-w-md">
              {variables.map((variable) => {
                const mapped = Boolean(variable.jsonPath || mappings?.[variable.name]);
                return (
                  <Badge
                    key={variable.name}
                    className="font-mono"
                    tone={variable.type === 'loop' ? 'indigo' : mapped ? 'emerald' : 'gray'}
                    title={variable.type === 'loop' ? `{#${variable.name}}` : `{${variable.name}}`}
                  >
                    {variable.type === 'loop' ? `{#${variable.name}}` : `{${variable.name}}`}
                  </Badge>
                );
              })}
            </div>
          </div>
          <p className="text-xs text-gray-500">
            Pick a field from the tree — loops are marked{' '}
            <span className="font-mono">list[]</span>, item fields sit inside them as{' '}
            <span className="font-mono">list[].name</span>. Each field shows its type and sample value; suggested
            values are prefilled, per-row ✓ previews appear after Save &amp; validate.
          </p>
          <div className="grid grid-cols-1 gap-2">
            {variables.map((variable) => {
              const tag = variable.name;
              const path = mappings?.[tag] ?? '';
              const result = validation?.find((r) => r.docxTag === tag);
              const suggestion = !editedTags[tag] && !variable.jsonPath ? suggestions[tag] : null;
              return (
                <div key={tag} className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span
                      title={tag}
                      className="w-48 shrink-0 break-words font-mono text-xs leading-5 text-gray-600"
                    >
                      {tag}
                    </span>
                    <span className="text-gray-300">→</span>
                    <PathSelect
                      value={path}
                      onChange={(p) => setPath(tag, p, false)}
                      paths={paths}
                      canonical={sampleCanonical}
                      rename={rename.out}
                      listFields={rename.listFields}
                    />
                    {suggestion && !path && (
                      <button
                        type="button"
                        onClick={() => setPath(tag, suggestion.path, true)}
                        title={`Apply suggested mapping: ${suggestion.path}`}
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium hover:opacity-80 ${CONF_STYLE[suggestion.confidence]}`}
                      >
                        Suggest: {suggestion.path} · {suggestion.confidence}
                      </button>
                    )}
                    {suggestion && path && (
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${CONF_STYLE[suggestion.confidence]}`}
                      >
                        {suggestion.confidence} confidence
                      </span>
                    )}
                  </div>
                  {result && (
                    <p
                      className={`ml-[15.5rem] text-[11px] font-mono ${
                        result.ok ? 'text-emerald-600' : 'text-red-600'
                      }`}
                    >
                      {result.ok ? `✓ ${result.sampleValue}` : `✗ ${result.message}`}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={() => setStep(0)}>
              ← Back
            </Button>
            <div className="flex gap-2">
              <Button
                variant="indigo"
                onClick={() => {
                  setNotice('');
                  if (parseSample()) saveMut.mutate(v.id);
                }}
                disabled={saveMut.isPending}
              >
                {saveMut.isPending ? 'Validating…' : 'Save & validate mappings'}
              </Button>
              <Button onClick={() => setStep(2)} disabled={!mappingGate}>
                Next: render test →
              </Button>
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-700">Render test</p>
          <p className="text-xs text-gray-500">
            Generates a test DOCX from the sample payload and converts it to PDF. Catches missing values, broken
            loops, bad template syntax and LibreOffice conversion failures.
          </p>
          <div className="flex items-center gap-3">
            <Button
              variant="indigo"
              onClick={() => {
                setNotice('');
                if (parseSample()) testMut.mutate(v.id);
              }}
              disabled={testMut.isPending}
            >
              {testMut.isPending ? 'Rendering + converting…' : 'Run render test'}
            </Button>
            {(testGate || v.docxTestStatus === 'passed') && (
              <Badge tone="green">DOCX passed</Badge>
            )}
            {(testGate || v.pdfTestStatus === 'passed') && <Badge tone="green">PDF passed</Badge>}
            {v.docxTestStatus === 'failed' && <Badge tone="red">DOCX failed</Badge>}
            {v.pdfTestStatus === 'failed' && <Badge tone="red">PDF failed</Badge>}
          </div>
          {(v.testDocxKey || testGate) && (
            <div className="flex gap-3">
              {v.testDocxKey && (
                <a
                  href={`${fileUrl(v.testDocxKey)}?download=test.docx`}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
                >
                  Test DOCX
                </a>
              )}
              {v.testPdfKey && (
                <a
                  href={`${fileUrl(v.testPdfKey)}?download=test.pdf`}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
                >
                  Test PDF
                </a>
              )}
            </div>
          )}
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={() => setStep(1)}>
              ← Back
            </Button>
            <Button onClick={() => setStep(3)} disabled={!testGate}>
              Next: publish →
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-700">Publish template</p>
          <p className="text-xs text-gray-500">
            Locks this version for real generation. Requires validated mappings and passing DOCX + PDF tests.
          </p>
          <ul className="space-y-1 text-xs">
            <Gate label="Mappings validated" ok={mappingGate} />
            <Gate label="DOCX render test passed" ok={testGate || v.docxTestStatus === 'passed'} />
            <Gate label="PDF conversion test passed" ok={testGate || v.pdfTestStatus === 'passed'} />
          </ul>
          {v.status === 'published' && (
            <Button
              variant="outlineIndigo"
              onClick={() => newVersionMut.mutate()}
              disabled={newVersionMut.isPending}
            >
              {newVersionMut.isPending ? 'Creating…' : 'New draft from published (v' + v.versionNo + ')'}
            </Button>
          )}
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={() => setStep(2)}>
              ← Back
            </Button>
            <Button
              variant="success"
              size="lg"
              onClick={() => {
                setNotice('');
                publishMut.mutate(v.id);
              }}
              disabled={publishMut.isPending || v.status === 'published' || !testGate}
            >
              {v.status === 'published' ? 'Published' : publishMut.isPending ? 'Publishing…' : 'Publish template'}
            </Button>
          </div>
        </div>
      )}
    </PageScaffold>
  );
}

function Gate({ label, ok }) {
  return (
    <li className="flex items-center gap-2">
      <span className={ok ? 'text-emerald-600' : 'text-gray-400'}>{ok ? '✓' : '•'}</span>
      <span className={ok ? 'text-gray-700' : 'text-gray-400'}>{label}</span>
    </li>
  );
}
