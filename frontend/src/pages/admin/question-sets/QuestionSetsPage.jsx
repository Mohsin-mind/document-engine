import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  listQuestionSets,
  createQuestionSet,
  deleteQuestionSet,
} from '../../../api/questions.js';
import { Button, Alert, StatusBadge, Input, Textarea, DataTable, Td, Loading } from '../../../components/ui';

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

  if (isLoading) return <Loading />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Question Sets</h2>
        <Button onClick={() => setCreating(true)}>New Question Set</Button>
      </div>

      {error && <Alert variant="error" className="mb-4">{error}</Alert>}

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
            <Input size="md" className="mt-1 w-full" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <Textarea size="md" className="mt-1 w-full" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button type="submit">Create</Button>
            <Button variant="outline" onClick={() => setCreating(false)}>Cancel</Button>
          </div>
        </form>
      )}

      <DataTable
        columns={[
          { header: 'Name' },
          { header: 'Status' },
          { header: 'Latest Version' },
          { header: 'Actions', align: 'right' },
        ]}
      >
        {sets?.map((s) => (
          <tr key={s.id}>
            <Td>
              <button className="text-slate-900 hover:underline" onClick={() => navigate(`/admin/question-sets/${s.id}`)}>
                {s.name}
              </button>
            </Td>
            <Td>
              <StatusBadge status={s.status} />
            </Td>
            <Td className="text-gray-600">
              {s.latestVersion ? `v${s.latestVersion.versionNo} (${s.latestVersion.status})` : '—'}
            </Td>
            <Td align="right" className="space-x-2">
              <Button variant="outline" size="xs" onClick={() => navigate(`/admin/question-sets/${s.id}`)}>
                Edit
              </Button>
              <Button
                variant="outlineDanger"
                size="xs"
                onClick={() => {
                  if (confirm(`Delete "${s.name}"? This removes all versions.`)) {
                    deleteMut.mutate(s.id);
                  }
                }}
              >
                Delete
              </Button>
            </Td>
          </tr>
        ))}
      </DataTable>
    </div>
  );
}