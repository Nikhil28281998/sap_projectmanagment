import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Spin } from 'antd';
import { AuthProvider } from './contexts/AuthContext';
import { ModuleProvider } from './contexts/ModuleContext';
import ErrorBoundary from './components/layout/ErrorBoundary';
import AppShell from './components/layout/AppShell';

// Lazy-loaded page components for code splitting
const DashboardRouter = lazy(() => import('./components/dashboard/DashboardRouter'));
const ExecutiveDashboard = lazy(() => import('./components/dashboard/ExecutiveDashboard'));
const TransportPipeline = lazy(() => import('./components/pipeline/TransportPipeline'));
const WorkItemList = lazy(() => import('./components/workitems/WorkItemList'));
const WorkItemDetail = lazy(() => import('./components/workitems/WorkItemDetail'));
const UnassignedTRs = lazy(() => import('./components/workitems/UnassignedTRs'));
const ReportBuilder = lazy(() => import('./components/tools/ReportBuilder'));
const WeeklyDigestPage = lazy(() => import('./components/tools/WeeklyDigestPage'));
const SettingsPage = lazy(() => import('./components/settings/SettingsPage'));
const AdminPage = lazy(() => import('./components/admin/AdminPage'));
const MethodologyPage = lazy(() => import('./components/settings/MethodologyPage'));

const PageFallback = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
    <Spin size="large" tip="Loading..." />
  </div>
);

const NotFound: React.FC = () => (
  <div style={{ textAlign: 'center', padding: 80 }}>
    <h2>404 — Page Not Found</h2>
    <p>The page you're looking for doesn't exist.</p>
    <a href="/">Go to Dashboard</a>
  </div>
);

const App: React.FC = () => {
  return (
    <ErrorBoundary>
    <BrowserRouter>
      <AuthProvider>
        <ModuleProvider>
        <AppShell>
          <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<DashboardRouter />} />
            <Route path="/executive" element={<ExecutiveDashboard />} />
            <Route path="/pipeline" element={<TransportPipeline />} />
            <Route path="/tracker" element={<WorkItemList />} />
            <Route path="/tracker/:type" element={<WorkItemList />} />
            {/* Legacy routes redirect */}
            <Route path="/workitems" element={<Navigate to="/tracker" replace />} />
            <Route path="/workitems/:type" element={<Navigate to="/tracker" replace />} />
            <Route path="/workitem/:id" element={<WorkItemDetail />} />
            <Route path="/unassigned" element={<UnassignedTRs />} />
            <Route path="/report" element={<ReportBuilder />} />
            <Route path="/digest" element={<WeeklyDigestPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/methodology" element={<MethodologyPage />} />
            {/* 404 catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
        </AppShell>
        </ModuleProvider>
      </AuthProvider>
    </BrowserRouter>
    </ErrorBoundary>
  );
};

export default App;
