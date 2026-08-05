import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { listRules, createRule, deleteRule } from '../../../api/rules.js';
import { listQuestionSets } from '../../../api/questions.js';
import { Button, Alert, StatusBadge, Select, DataTable, Td, Loading } from '../../../components/ui';

const emptyDefinition = () => ({
  flags: [],
  computed: [],
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

  if (isLoading) return <Loading />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Rules</h2>
        <Button onClick={() => setCreating(true)}>New Rule</Button>
      </div>

      {error && <Alert variant="error" className="mb-4">{error}</Alert>}

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
            <Select size="md" className="mt-1 w-full" value={questionSetId} onChange={(e) => setQuestionSetId(e.target.value)}>
              <option value="">— select —</option>
              {questionSets?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex gap-2">
            <Button type="submit">Create</Button>
            <Button variant="outline" onClick={() => setCreating(false)}>Cancel</Button>
          </div>
        </form>
      )}

      <DataTable
        columns={[
          { header: 'Version' },
          { header: 'Question Set' },
          { header: 'Status' },
          { header: 'Flags' },
          { header: 'Actions', align: 'right' },
        ]}
      >
        {rules?.map((r) => (
          <tr key={r.id}>
            <Td className="font-mono text-xs text-gray-500">v{r.versionNo}</Td>
            <Td className="text-gray-700">{setById(questionSets, r.questionSetId)?.name || r.questionSetId}</Td>
            <Td>
              <StatusBadge status={r.status} />
            </Td>
            <Td className="text-xs text-gray-500">
              {(r.definition.flags || []).map((f) => f.key).filter(Boolean).join(', ') || '—'}
            </Td>
            <Td align="right" className="space-x-2">
              <Button variant="outline" size="xs" onClick={() => navigate(`/admin/rules/${r.id}`)}>
                Edit
              </Button>
              <Button
                variant="outlineDanger"
                size="xs"
                onClick={() => {
                  if (confirm('Delete this rule?')) deleteMut.mutate(r.id);
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