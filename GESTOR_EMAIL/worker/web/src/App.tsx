import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout.tsx';
import { SetupPage } from './pages/SetupPage.tsx';
import { ApprovalPage } from './pages/ApprovalPage.tsx';
import { ReportPage } from './pages/ReportPage.tsx';
import { WorkerPage } from './pages/WorkerPage.tsx';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/setup" element={<SetupPage />} />
        <Route element={<Layout />}>
          <Route path="/" element={<ApprovalPage />} />
          <Route path="/report" element={<ReportPage />} />
          <Route path="/worker" element={<WorkerPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}
