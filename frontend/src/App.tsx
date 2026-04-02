import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import AppShell from './components/layout/AppShell';
import HomeDashboard from './components/dashboard/HomeDashboard';
import TransportPipeline from './components/pipeline/TransportPipeline';
import WorkItemList from './components/workitems/WorkItemList';
import WorkItemDetail from './components/workitems/WorkItemDetail';
import UnassignedTRs from './components/workitems/UnassignedTRs';
import TRSearch from './components/tools/TRSearch';
import ReportBuilder from './components/tools/ReportBuilder';
import SettingsPage from './components/settings/SettingsPage';
import MethodologyPage from './components/settings/MethodologyPage';
import AdminPage from './components/admin/AdminPage';

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppShell>
          <Routes>
            <Route path="/" element={<HomeDashboard />} />
            <Route path="/pipeline" element={<TransportPipeline />} />
            <Route path="/workitems" element={<WorkItemList />} />
            <Route path="/workitems/:type" element={<WorkItemList />} />
            <Route path="/workitem/:id" element={<WorkItemDetail />} />
            <Route path="/unassigned" element={<UnassignedTRs />} />
            <Route path="/search" element={<TRSearch />} />
            <Route path="/report" element={<ReportBuilder />} />
            <Route path="/methodologies" element={<MethodologyPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/admin" element={<AdminPage />} />
          </Routes>
        </AppShell>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
