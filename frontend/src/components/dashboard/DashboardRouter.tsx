import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import DashboardPage from './DashboardPage';

/**
 * DashboardRouter — Renders the module-specific dashboard.
 *
 * Routing logic:
 *  - Executive-only users → redirect to /executive
 *  - All others → unified DashboardPage parameterized by active module
 */
const DashboardRouter: React.FC = () => {
  const { user } = useAuth();

  const isAdmin = user?.isAdmin ?? false;
  const isExecutive = user?.isExecutive ?? false;
  const isManager = user?.isManager ?? false;
  const isDeveloper = user?.isDeveloper ?? false;

  // Executive-only users (not admin, not manager, not developer) redirect to executive dashboard
  const isExecOnly = isExecutive && !isAdmin && !isManager && !isDeveloper;
  if (isExecOnly) {
    return <Navigate to="/executive" replace />;
  }

  return <DashboardPage application="SAP" />;
};

export default DashboardRouter;
