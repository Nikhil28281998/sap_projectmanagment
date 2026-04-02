import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useModule } from '../../contexts/ModuleContext';
import HomeDashboard from './HomeDashboard';
import CoupaDashboard from './CoupaDashboard';
import CommercialDashboard from './CommercialDashboard';

/**
 * DashboardRouter — Renders the module-specific dashboard.
 *
 * Routing logic:
 *  - Executive-only users → redirect to /executive
 *  - All others → module-specific dashboard (SAP / Coupa / Commercial)
 *
 * Executive Dashboard is now a separate sidebar menu item at /executive.
 */
const DashboardRouter: React.FC = () => {
  const { user } = useAuth();
  const { activeModule } = useModule();

  const isAdmin = user?.isAdmin ?? false;
  const isExecutive = user?.isExecutive ?? false;
  const isManager = user?.isManager ?? false;
  const isDeveloper = user?.isDeveloper ?? false;

  // Executive-only users (not admin, not manager, not developer) redirect to executive dashboard
  const isExecOnly = isExecutive && !isAdmin && !isManager && !isDeveloper;
  if (isExecOnly) {
    return <Navigate to="/executive" replace />;
  }

  // Module-specific dashboard
  switch (activeModule) {
    case 'coupa': return <CoupaDashboard />;
    case 'commercial': return <CommercialDashboard />;
    case 'sap':
    default: return <HomeDashboard />;
  }
};

export default DashboardRouter;
