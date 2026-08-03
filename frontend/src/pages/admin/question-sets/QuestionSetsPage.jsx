import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  listQuestionSets,
  createQuestionSet,
  deleteQuestionSet,
} from '../../../api/questions.js';

const emptyDefinition = () => ({
  sections: [{ id: 'section1', title: 'Section 1', questions: [] }],
});

export default function QuestionSetsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  const { data: sets, isLoading } = useQuery({
    queryKey: ['question-sets'],
    queryFn: listQuestionSets,
  });

  const createMut = useMutation({
    mutationFn: createQuestionSet,
    onSuccess: (set) => {
      queryClient.invalidateQueries({ queryKey: ['question-sets'] });
      navigate(`/admin/question-sets/${set.id}`);
    },
    onError: (e) => setError(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: deleteQuestionSet,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['question-sets'] }),
    onError: (e) => setError(e.message),
  });

  if (isLoading) return <p className="text-gray-500">Loading…</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Question Sets</h2>
        <button
          onClick={() => setCreating(true)}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          New Question Set
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
            createMut.mutate({ name, description, definition: emptyDefinition() });
          }}
          className="mb-6 rounded-lg border border-gray-200 bg-white p-4 space-y-3"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              rows={2}
            />
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
              <th className="px-4 py-3 text-left font-medium text-gray-600">Name</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Latest Version</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sets?.map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-3">
                  <button
                    className="text-slate-900 hover:underline"
                    onClick={() => navigate(`/admin/question-sets/${s.id}`)}
                  >
                    {s.name}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      s.status === 'published'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {s.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {s.latestVersion ? `v${s.latestVersion.versionNo} (${s.latestVersion.status})` : '—'}
                </td>
                <td className="px-4 py-3 text-right space-x-2">
                  <button
                    onClick={() => navigate(`/admin/question-sets/${s.id}`)}
                    className="rounded-md border border-gray-300 px-3 py-1 text-xs hover:bg-gray-50"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete "${s.name}"? This removes all versions.`)) {
                        deleteMut.mutate(s.id);
                      }
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
