import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { listRules, createRule, deleteRule } from '../../../api/rules.js';
import { listQuestionSets } from '../../../api/questions.js';

const emptyDefinition = () => ({
  flags: [{ key: '', when: { field: '', equals: '' } }],
  computed: [{ key: '', template: '' }],
  includeGroups: [],
});

export default function RulesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [questionSetId, setQuestionSetId] = useState('');
  const [error, setError] = useState('');

  const { data: rules, isLoading } = useQuery({ queryKey: ['rules'], queryFn: () => listRules() });
  const { data: questionSets } = useQuery({ queryKey: ['question-sets'], queryFn: listQuestionSets });

  const createMut = useMutation({
    mutationFn: createRule,
    onSuccess: (rule) => {
      queryClient.invalidateQueries({ queryKey: ['rules'] });
      navigate(`/admin/rules/${rule.id}`);
    },
    onError: (e) => setError(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: deleteRule,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rules'] }),
    onError: (e) => setError(e.message),
  });

  const setById = (map, id) => map?.find((s) => s.id === id);

  if (isLoading) return <p className="text-gray-500">Loading…</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Rules</h2>
        <button
          onClick={() => setCreating(true)}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          New Rule
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {creating && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError('');
            if (!questionSetId) return setError('Select a question set');
            createMut.mutate({ questionSetId, definition: emptyDefinition() });
          }}
          className="mb-6 rounded-lg border border-gray-200 bg-white p-4 space-y-3"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700">Question set</label>
            <select
              value={questionSetId}
              onChange={(e) => setQuestionSetId(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">— select —</option>
              {questionSets?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white">
              Create
            </button>
            <button
              type="button"
              onClick={() => setCreating(false)}
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
              <th className="px-4 py-3 text-left font-medium text-gray-600">Version</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Question Set</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Flags</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rules?.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">v{r.versionNo}</td>
                <td className="px-4 py-3 text-gray-700">
                  {setById(questionSets, r.questionSetId)?.name || r.questionSetId}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      r.status === 'published'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {r.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {(r.definition.flags || []).map((f) => f.key).filter(Boolean).join(', ') || '—'}
                </td>
                <td className="px-4 py-3 text-right space-x-2">
                  <button
                    onClick={() => navigate(`/admin/rules/${r.id}`)}
                    className="rounded-md border border-gray-300 px-3 py-1 text-xs hover:bg-gray-50"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Delete this rule?')) deleteMut.mutate(r.id);
                    }}
                    className="rounded-md border border-red-200 px-3 py-1 text-xs text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
