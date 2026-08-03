import { Routes, Route, Navigate } from 'react-router-dom';
import AdminLayout from './components/layout/AdminLayout.jsx';
import QuestionSetsPage from './pages/admin/question-sets/QuestionSetsPage.jsx';
import QuestionSetEditorPage from './pages/admin/question-sets/QuestionSetEditorPage.jsx';
import RulesPage from './pages/admin/rules/RulesPage.jsx';
import RulesEditorPage from './pages/admin/rules/RulesEditorPage.jsx';
import TemplatesPage from './pages/admin/templates/TemplatesPage.jsx';
import TemplateEditorPage from './pages/admin/templates/TemplateEditorPage.jsx';
import SimulationPage from './pages/simulation/SimulationPage.jsx';
import ReviewPage from './pages/review/ReviewPage.jsx';
import DownloadsPage from './pages/downloads/DownloadsPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route path="/admin/question-sets" element={<QuestionSetsPage />} />
        <Route path="/admin/question-sets/:id" element={<QuestionSetEditorPage />} />
        <Route path="/admin/rules" element={<RulesPage />} />
        <Route path="/admin/rules/:id" element={<RulesEditorPage />} />
        <Route path="/admin/templates" element={<TemplatesPage />} />
        <Route path="/admin/templates/:id" element={<TemplateEditorPage />} />
        <Route path="/simulation" element={<SimulationPage />} />
        <Route path="/review" element={<ReviewPage />} />
        <Route path="/downloads" element={<DownloadsPage />} />
        <Route path="*" element={<Navigate to="/simulation" replace />} />
      </Route>
    </Routes>
  );
}
