import React, { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppShell from './components/layout/AppShell';
import HomeDashboard from './components/dashboard/HomeDashboard';
import TransportPipeline from './components/pipeline/TransportPipeline';
import WorkItemList from './components/workitems/WorkItemList';
import WorkItemDetail from './components/workitems/WorkItemDetail';
import UnassignedTRs from './components/workitems/UnassignedTRs';
import TRSearch from './components/tools/TRSearch';
import ReportBuilder from './components/tools/ReportBuilder';
import SettingsPage from './components/settings/SettingsPage';

const App: React.FC = () => {
  return (
    <BrowserRouter>
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
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
};

export default App;
