import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  getQuestionnaire,
  getSubmission,
  createSubmission,
  saveSubmission,
  submitSubmission,
} from '../../api/submissions.js';
import { conditionMatches, validateAnswers } from '@document-engine/shared';
import { FieldRenderer } from '../../components/inputs/FieldInput.jsx';
import GenerationStatus from '../../components/simulation/GenerationStatus.jsx';

export default function SimulationPage() {
  const [searchParams] = useSearchParams();
  const [questionnaire, setQuestionnaire] = useState(null);
  const [submissionId, setSubmissionId] = useState(null);
  const [answers, setAnswers] = useState({});
  const [sectionIndex, setSectionIndex] = useState(0);
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const q = await getQuestionnaire();
        setQuestionnaire(q);
        const resumeId = searchParams.get('id');
        if (resumeId) {
          const existing = await getSubmission(resumeId);
          setSubmissionId(existing.id);
          setAnswers(existing.answers || {});
          setSubmitted(existing.status === 'submitted');
        }
      } catch (e) {
        setLoadError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [searchParams]);

  const definition = questionnaire?.definition;
  const sections = definition?.sections || [];
  const current = sections[sectionIndex];

  const visibleQuestions = useMemo(() => {
    if (!current || current.repeatable) return [];
    return (current.questions || []).filter((q) => conditionMatches(q.condition, answers));
  }, [current, answers]);

  const completedSections = useMemo(() => {
    if (!definition) return 0;
    let count = 0;
    for (let i = 0; i < sectionIndex; i += 1) {
      const section = sections[i];
      const check = validateAnswers({ sections: [section] }, answers);
      if (check.valid) count += 1;
    }
    return count;
  }, [definition, sections, sectionIndex, answers]);

  const setAnswer = (id, value) => setAnswers((prev) => ({ ...prev, [id]: value }));
  const setGroupRow = (groupId, index, fieldId, value) =>
    setAnswers((prev) => ({
      ...prev,
      [groupId]: (prev[groupId] || []).map((row, i) => (i === index ? { ...row, [fieldId]: value } : row)),
    }));

  const addRow = (groupId) =>
    setAnswers((prev) => ({ ...prev, [groupId]: [...(prev[groupId] || []), {}] }));
  const removeRow = (groupId, index) =>
    setAnswers((prev) => ({ ...prev, [groupId]: (prev[groupId] || []).filter((_, i) => i !== index) }));

  const validateSection = (section, sectionAnswers) => {
    const check = validateAnswers({ sections: [section] }, sectionAnswers);
    const map = {};
    for (const e of check.errors) map[e.path] = e.message;
    setErrors(map);
    return check.valid;
  };

  const goNext = () => {
    if (validateSection(current, answers)) setSectionIndex((i) => Math.min(i + 1, sections.length - 1));
  };
  const goBack = () => {
    setErrors({});
    setSectionIndex((i) => Math.max(i - 1, 0));
  };

  const saveDraft = async () => {
    setSaving(true);
    try {
      let id = submissionId;
      if (id) {
        await saveSubmission(id, answers);
      } else {
        const created = await createSubmission(answers);
        id = created.id;
        setSubmissionId(id);
      }
      setSavedAt(new Date().toLocaleTimeString());
      return id;
    } catch (e) {
      setLoadError(e.message);
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    const id = submissionId || (await saveDraft());
    if (!id) return;
    try {
      const result = await submitSubmission(id);
      setSubmitted(true);
    } catch (e) {
      setLoadError(e.message);
    }
  };

  if (loading) return <p className="text-gray-500">Loading…</p>;
  if (loadError) {
    return (
      <div className="rounded-md bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">{loadError}</div>
    );
  }
  if (submitted) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center">
        <div className="rounded-full bg-green-100 w-12 h-12 mx-auto flex items-center justify-center text-green-700 text-2xl">✓</div>
        <h2 className="mt-4 text-xl font-semibold">Submission received</h2>
        <p className="mt-2 text-sm text-gray-600">
          Thank you. Your answers have been validated and the following documents are being prepared:
        </p>
        {submissionId && <GenerationStatus submissionId={submissionId} />}
        <a
          href="/downloads"
          className="mt-6 inline-block rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Open Download Center
        </a>
      </div>
    );
  }

  const progress = ((sectionIndex + 1) / sections.length) * 100;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h2 className="text-xl font-semibold">{questionnaire.name}</h2>
        <p className="text-sm text-gray-500">{questionnaire.description}</p>
      </div>

      <div className="mb-6">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>
            {completedSections} of {sections.length} sections complete
          </span>
          <span>Step {sectionIndex + 1} of {sections.length}</span>
        </div>
        <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
          <div className="h-full bg-indigo-600 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="text-lg font-semibold mb-4">{current.title}</h3>

        {current.repeatable ? (
          <div className="space-y-4">
            {(answers[current.repeatable.id] || []).map((row, rowIndex) => (
              <div key={rowIndex} className="rounded-md border border-gray-200 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">
                    {current.repeatable.label} #{rowIndex + 1}
                  </span>
                  <button
                    onClick={() => removeRow(current.repeatable.id, rowIndex)}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Remove
                  </button>
                </div>
                {current.repeatable.fields.map((f) => (
                  <FieldRenderer
                    key={f.id}
                    field={f}
                    value={row[f.id]}
                    onChange={(v) => setGroupRow(current.repeatable.id, rowIndex, f.id, v)}
                    error={errors[`${current.repeatable.id}[${rowIndex}].${f.id}`]}
                  />
                ))}
              </div>
            ))}
            <button
              onClick={() => addRow(current.repeatable.id)}
              className="rounded-md border border-dashed border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
            >
              + {current.repeatable.addLabel || `Add ${current.repeatable.label.toLowerCase()}`}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {visibleQuestions.map((q) => (
              <FieldRenderer
                key={q.id}
                field={q}
                value={answers[q.id]}
                onChange={(v) => setAnswer(q.id, v)}
                error={errors[q.id]}
              />
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <div className="flex gap-2">
          {sectionIndex > 0 && (
            <button
              onClick={goBack}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
            >
              Back
            </button>
          )}
          {sectionIndex < sections.length - 1 && (
            <button
              onClick={goNext}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
            >
              Next
            </button>
          )}
          {sectionIndex === sections.length - 1 && (
            <button
              onClick={handleSubmit}
              className="rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-600"
            >
              Submit
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          {savedAt && <span className="text-xs text-gray-400">Saved {savedAt}</span>}
          <button
            onClick={saveDraft}
            disabled={saving}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save progress'}
          </button>
        </div>
      </div>
    </div>
  );
}
