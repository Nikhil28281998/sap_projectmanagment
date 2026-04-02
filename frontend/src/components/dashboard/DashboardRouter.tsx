import React, { useState } from 'react';
import { Space, Segmented, Typography, Tag } from 'antd';
import {
  DashboardOutlined, ApartmentOutlined, ShoppingCartOutlined,
  MedicineBoxOutlined, FundProjectionScreenOutlined,
} from '@ant-design/icons';
import { useAuth } from '../../contexts/AuthContext';
import { useModule } from '../../contexts/ModuleContext';
import HomeDashboard from './HomeDashboard';
import ExecutiveDashboard from './ExecutiveDashboard';
import CoupaDashboard from './CoupaDashboard';
import CommercialDashboard from './CommercialDashboard';

const { Text } = Typography;

type DashboardView = 'module' | 'executive';

/**
 * DashboardRouter — Decides which dashboard to render based on role & module.
 *
 * Routing logic:
 *  - Executive-only users → always see ExecutiveDashboard
 *  - Admin users → can toggle between module dashboard & executive view
 *  - Manager/Developer → module-specific dashboard (SAP / Coupa / Commercial)
 */
const DashboardRouter: React.FC = () => {
  const { user, canWrite, canConfigure } = useAuth();
  const { activeModule } = useModule();
  const [view, setView] = useState<DashboardView>('module');

  const isAdmin = user?.isAdmin ?? false;
  const isExecutive = user?.isExecutive ?? false;
  const isManager = user?.isManager ?? false;
  const isDeveloper = user?.isDeveloper ?? false;

  // Executive-only users (not admin, not manager, not developer) always see executive dashboard
  const isExecOnly = isExecutive && !isAdmin && !isManager && !isDeveloper;
  if (isExecOnly) {
    return <ExecutiveDashboard />;
  }

  // Module-specific dashboard component
  const ModuleDashboard = (() => {
    switch (activeModule) {
      case 'coupa': return CoupaDashboard;
      case 'commercial': return CommercialDashboard;
      case 'sap':
      default: return HomeDashboard;
    }
  })();

  const moduleIcon = activeModule === 'coupa'
    ? <ShoppingCartOutlined />
    : activeModule === 'commercial'
    ? <MedicineBoxOutlined />
    : <ApartmentOutlined />;

  const moduleLabel = activeModule === 'coupa'
    ? 'Coupa BSM'
    : activeModule === 'commercial'
    ? 'Life Sciences'
    : 'SAP PM';

  // Admin & Executive can toggle between module view and executive view
  const canSeeExecutive = isAdmin || isExecutive;

  return (
    <div>
      {canSeeExecutive && (
        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <Space size={8}>
            <DashboardOutlined />
            <Text strong style={{ fontSize: 13 }}>Dashboard View:</Text>
          </Space>
          <Segmented
            value={view}
            onChange={(v) => setView(v as DashboardView)}
            options={[
              {
                value: 'module',
                label: (
                  <Space size={4}>
                    {moduleIcon}
                    <span>{moduleLabel}</span>
                  </Space>
                ),
              },
              {
                value: 'executive',
                label: (
                  <Space size={4}>
                    <FundProjectionScreenOutlined />
                    <span>Executive Dashboard</span>
                  </Space>
                ),
              },
            ]}
          />
          {view === 'executive' && (
            <Tag color="purple" style={{ marginLeft: 4 }}>Cross-Module View</Tag>
          )}
        </div>
      )}

      {view === 'executive' && canSeeExecutive ? <ExecutiveDashboard /> : <ModuleDashboard />}
    </div>
  );
};

export default DashboardRouter;
