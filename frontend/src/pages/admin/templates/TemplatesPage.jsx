import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { listTemplates, createTemplate, deleteTemplate } from '../../../api/templates.js';
import { listQuestionSets } from '../../../api/questions.js';

export default function TemplatesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showUpload, setShowUpload] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [questionSetId, setQuestionSetId] = useState('');
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');

  const { data: templates, isLoading } = useQuery({ queryKey: ['templates'], queryFn: listTemplates });
  const { data: questionSets } = useQuery({ queryKey: ['question-sets'], queryFn: listQuestionSets });

  const uploadMut = useMutation({
    mutationFn: createTemplate,
    onSuccess: (template) => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      navigate(`/admin/templates/${template.templateId}`);
    },
    onError: (e) => setError(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: deleteTemplate,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['templates'] }),
    onError: (e) => setError(e.message),
  });

  if (isLoading) return <p className="text-gray-500">Loading…</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Templates</h2>
        <button
          onClick={() => setShowUpload(true)}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Upload Template
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">{error}</div>
      )}

      {showUpload && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError('');
            if (!file) return setError('Select a .docx file');
            const formData = new FormData();
            formData.append('name', name);
            formData.append('description', description);
            formData.append('questionSetId', questionSetId);
            formData.append('file', file);
            uploadMut.mutate(formData);
          }}
          className="mb-6 rounded-lg border border-gray-200 bg-white p-4 space-y-3 max-w-lg"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="e.g. Last Will & Testament"
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
          <div>
            <label className="block text-sm font-medium text-gray-700">Question set</label>
            <select
              value={questionSetId}
              onChange={(e) => setQuestionSetId(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">— none —</option>
              {questionSets?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">DOCX file</label>
            <input
              type="file"
              accept=".docx"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="mt-1 w-full text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white">
              Upload
            </button>
            <button
              type="button"
              onClick={() => setShowUpload(false)}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Name</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Mapping</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">DOCX test</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">PDF test</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {templates?.map((t) => {
              const v = t.latestVersion;
              return (
                <tr key={t.id}>
                  <td className="px-4 py-3 text-gray-700">
                    {t.name}
                    <span className="ml-2 font-mono text-xs text-gray-400">v{v?.versionNo}</span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge ok={t.status === 'published'} yes="published" no="draft" />
                  </td>
                  <td className="px-4 py-3">
                    <Badge ok={v?.mappingStatus === 'mapped-validated'} yes="validated" no={v?.mappingStatus || 'unmapped'} />
                  </td>
                  <td className="px-4 py-3">
                    <Badge ok={v?.docxTestStatus === 'passed'} yes="passed" no={v?.docxTestStatus || 'not-tested'} />
                  </td>
                  <td className="px-4 py-3">
                    <Badge ok={v?.pdfTestStatus === 'passed'} yes="passed" no={v?.pdfTestStatus || 'not-tested'} />
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      onClick={() => navigate(`/admin/templates/${t.id}`)}
                      className="rounded-md border border-gray-300 px-3 py-1 text-xs hover:bg-gray-50"
                    >
                      Open pipeline
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Delete this template?')) deleteMut.mutate(t.id);
                      }}
                      className="rounded-md border border-red-200 px-3 py-1 text-xs text-red-600 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Badge({ ok, yes, no }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        ok ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
      }`}
    >
      {ok ? yes : no}
    </span>
  );
}
