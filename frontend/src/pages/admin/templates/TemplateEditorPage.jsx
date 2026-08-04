import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { getTemplate, saveMappings, runRenderTest, publishTemplate } from '../../../api/templates.js';

const fileUrl = (key) => (key ? `/api/files/${encodeURIComponent(key)}` : null);

function identityPath(name, type) {
  return type === 'loop' ? `${name}[]` : name;
}

export default function TemplateEditorPage() {
  const { id } = useParams();
  const [mappings, setMappings] = useState(null);
  const [sampleText, setSampleText] = useState(
    '{\n  "customer": { "fullName": "John Andrew Smith" },\n  "flags": { "hasSpouse": true },\n  "children": [ { "name": "Emma", "dob": "2008-04-12" } ]\n}'
  );
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [validation, setValidation] = useState(null);

  const { data: template, isLoading, isError, error: queryError } = useQuery({
    queryKey: ['template', id],
    queryFn: () => getTemplate(id),
  });

  useEffect(() => {
    if (template) {
      const v = template.versions[0];
      if (!mappings && v) {
        const next = {};
        for (const variable of v.extractedVariables) {
          next[variable.name] = variable.jsonPath ?? identityPath(variable.name, variable.type);
        }
        setMappings(next);
      }
    }
  }, [template, mappings]);

  const saveMut = useMutation({
    mutationFn: (vId) => saveMappings(id, vId, { mappings, sampleCanonical: JSON.parse(sampleText) }),
    onSuccess: (saved) => {
      setValidation(saved.validation || null);
      setNotice('Mappings saved and validated');
    },
    onError: (e) => setError(e.message),
  });

  const testMut = useMutation({
    mutationFn: (vId) => runRenderTest(id, vId, JSON.parse(sampleText)),
    onSuccess: () => setNotice('Render test completed'),
    onError: (e) => setError(`Test failed: ${e.message}`),
  });

  const publishMut = useMutation({
    mutationFn: (vId) => publishTemplate(id, vId),
    onSuccess: () => setNotice('Template published'),
    onError: (e) => setError(e.message),
  });

  if (isLoading || !template) return <p className="text-gray-500">Loading…</p>;
  if (isError) {
    return (
      <div className="rounded-md bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
        Failed to load template: {queryError?.message}
      </div>
    );
  }
  const v = template.versions[0];
  if (!v) return <p className="text-gray-500">No version</p>;

  const steps = [
    { label: 'Mappings validated', done: v.mappingStatus === 'mapped-validated' },
    { label: 'DOCX render test', done: v.docxTestStatus === 'passed' },
    { label: 'PDF conversion test', done: v.pdfTestStatus === 'passed' },
  ];

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

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">{template.name}</h2>
          <p className="text-sm text-gray-500">
            v{v.versionNo} · {v.status}
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href={fileUrl(`templates/${template.id}/v${v.versionNo}/source.docx`)}
            download="source.docx"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
          >
            Source DOCX
          </a>
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
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">{error}</div>
      )}
      {notice && (
        <div className="rounded-md bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-700">{notice}</div>
      )}

      <ol className="flex gap-2">
        {steps.map((s, i) => (
          <li key={s.label} className="flex items-center gap-2 text-xs">
            <span
              className={`rounded-full px-2.5 py-1 ${
                s.done ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
              }`}
            >
              {i + 1}. {s.label}
            </span>
            {i < steps.length - 1 && <span className="text-gray-300">→</span>}
          </li>
        ))}
      </ol>

      <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
        <p className="text-sm font-semibold text-gray-700">
          Extracted variables{' '}
          <span className="font-normal text-gray-400">
            ({v.extractedVariables.filter((x) => x.jsonPath).length} of {v.extractedVariables.length} mapped)
          </span>
        </p>
        <div className="flex flex-wrap gap-1.5">
          {v.extractedVariables.map((variable) => {
            const mapped = Boolean(variable.jsonPath);
            return (
              <span
                key={variable.name}
                className={`rounded-full px-2 py-0.5 text-xs font-mono ${
                  variable.type === 'loop'
                    ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200'
                    : mapped
                      ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                      : 'bg-gray-100 text-gray-700'
                }`}
              >
                {variable.type === 'loop' ? `{#${variable.name}}` : `{${variable.name}}`}
              </span>
            );
          })}
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
        <p className="text-sm font-semibold text-gray-700">Mapping — template tag → canonical JSON path</p>
        <p className="text-xs text-gray-500">
          Loops use <span className="font-mono">path[]</span>, item fields use{' '}
          <span className="font-mono">children[].name</span>. Paths are validated against the sample canonical
          payload below; per-row ✓ previews appear after Save &amp; validate.
        </p>
        <div className="grid grid-cols-[1fr_1fr] gap-2">
          {Object.entries(mappings || {}).map(([tag, path]) => {
            const result = validation?.find((r) => r.docxTag === tag);
            return (
              <div key={tag} className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="w-40 truncate font-mono text-xs text-gray-600">{tag}</span>
                  <span className="text-gray-300">→</span>
                  <input
                    value={path}
                    onChange={(e) => {
                      setMappings({ ...mappings, [tag]: e.target.value });
                      setValidation(null);
                    }}
                    className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs font-mono"
                  />
                </div>
                {result && (
                  <p
                    className={`ml-40 text-[11px] font-mono ${
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

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Sample canonical payload (used for validation + render test)
          </label>
          <textarea
            value={sampleText}
            onChange={(e) => setSampleText(e.target.value)}
            rows={7}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs font-mono"
          />
        </div>
        <button
          onClick={() => {
            setNotice('');
            if (parseSample()) saveMut.mutate(v.id);
          }}
          disabled={saveMut.isPending}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {saveMut.isPending ? 'Validating…' : 'Save & validate mappings'}
        </button>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
        <p className="text-sm font-semibold text-gray-700">Render test</p>
        <p className="text-xs text-gray-500">
          Runs the rule-style render with the mapped sample payload: generates a test DOCX and converts it to PDF.
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setNotice('');
              if (parseSample()) testMut.mutate(v.id);
            }}
            disabled={testMut.isPending}
            className="rounded-md bg-indigo-700 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600 disabled:opacity-50"
          >
            {testMut.isPending ? 'Rendering + converting…' : 'Run render test'}
          </button>
          {v.docxTestStatus === 'passed' && <Badge ok yes="DOCX passed" />}
          {v.pdfTestStatus === 'passed' && <Badge ok yes="PDF passed" />}
        </div>
      </div>

      <div className="flex items-center gap-3 border-t border-gray-200 pt-4">
        <button
          onClick={() => {
            setNotice('');
            publishMut.mutate(v.id);
          }}
          disabled={publishMut.isPending || v.status === 'published'}
          className="rounded-md bg-green-700 px-5 py-2 text-sm font-medium text-white hover:bg-green-600 disabled:opacity-40"
        >
          {v.status === 'published' ? 'Published' : publishMut.isPending ? 'Publishing…' : 'Publish template'}
        </button>
      </div>
    </div>
  );
}

function Badge({ ok, yes }) {
  return (
    <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">{yes}</span>
  );
}
