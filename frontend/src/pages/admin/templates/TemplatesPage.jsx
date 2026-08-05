import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { listTemplates, createTemplate, deleteTemplate } from '../../../api/templates.js';
import { Button, Alert, Badge, StatusBadge, DataTable, Td, Loading } from '../../../components/ui';

export default function TemplatesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const [error, setError] = useState('');

  const { data: templates, isLoading } = useQuery({ queryKey: ['templates'], queryFn: listTemplates });

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

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    const formData = new FormData();
    formData.append('name', file.name.replace(/\.docx$/i, ''));
    formData.append('description', '');
    formData.append('questionSetId', '');
    formData.append('file', file);
    uploadMut.mutate(formData);
  };

  if (isLoading) return <Loading />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Templates</h2>
        <Button onClick={() => fileInputRef.current?.click()}>Upload Template</Button>
        <input ref={fileInputRef} type="file" accept=".docx" className="hidden" onChange={handleFile} />
      </div>

      {error && <Alert variant="error" className="mb-4">{error}</Alert>}

      {uploadMut.isPending && (
        <Alert variant="info" className="mb-4">
          Uploading {uploadMut.variables?.get('name') || 'template'}…
        </Alert>
      )}

      <DataTable
        columns={[
          { header: 'Name' },
          { header: 'Status' },
          { header: 'Mapping' },
          { header: 'DOCX test' },
          { header: 'PDF test' },
          { header: 'Actions', align: 'right' },
        ]}
      >
        {templates?.map((t) => {
          const v = t.latestVersion;
          return (
            <tr key={t.id}>
              <Td className="text-gray-700">
                <span title={t.name}>{t.name}</span>
                <span className="ml-2 font-mono text-xs text-gray-400">v{v?.versionNo}</span>
              </Td>
              <Td>
                <StatusBadge status={t.status} />
              </Td>
              <Td>
                <Badge tone={v?.mappingStatus === 'mapped-validated' ? 'green' : 'amber'}>
                  {v?.mappingStatus === 'mapped-validated' ? 'validated' : v?.mappingStatus || 'unmapped'}
                </Badge>
              </Td>
              <Td>
                <Badge tone={v?.docxTestStatus === 'passed' ? 'green' : 'amber'}>
                  {v?.docxTestStatus === 'passed' ? 'passed' : v?.docxTestStatus || 'not-tested'}
                </Badge>
              </Td>
              <Td>
                <Badge tone={v?.pdfTestStatus === 'passed' ? 'green' : 'amber'}>
                  {v?.pdfTestStatus === 'passed' ? 'passed' : v?.pdfTestStatus || 'not-tested'}
                </Badge>
              </Td>
              <Td align="right" className="space-x-2">
                <Button variant="outline" size="xs" onClick={() => navigate(`/admin/templates/${t.id}`)}>
                  Open pipeline
                </Button>
                <Button
                  variant="outlineDanger"
                  size="xs"
                  onClick={() => {
                    if (confirm('Delete this template?')) deleteMut.mutate(t.id);
                  }}
                >
                  Delete
                </Button>
              </Td>
            </tr>
          );
        })}
      </DataTable>
    </div>
  );
}