import React, { createContext, useContext, useState, useEffect } from 'react';

export type ModuleKey = 'sap' | 'coupa' | 'commercial';

export interface ModuleDefinition {
  key: ModuleKey;
  name: string;
  shortName: string;
  icon: string;
  color: string;
  description: string;
  workItemTypes: string[];
  terminology: {
    transport: string;
    pipeline: string;
    system: string;
    environments: string;
    workItem: string;
  };
  phases: string[];
}

export const MODULE_DEFINITIONS: Record<ModuleKey, ModuleDefinition> = {
  sap: {
    key: 'sap',
    name: 'SAP Project Management',
    shortName: 'SAP PM',
    icon: '⚙️',
    color: '#1677ff',
    description: 'SAP Transport & Project Management',
    workItemTypes: ['Project', 'Enhancement', 'Break-fix', 'Support', 'Hypercare', 'Upgrade'],
    terminology: {
      transport: 'Transport Request',
      pipeline: 'Transport Pipeline',
      system: 'SAP System',
      environments: 'DEV → QAS → PRD',
      workItem: 'Work Item',
    },
    phases: ['Planning', 'Development', 'Testing', 'Go-Live', 'Hypercare', 'Complete'],
  },
  coupa: {
    key: 'coupa',
    name: 'Coupa Spend Management',
    shortName: 'Coupa BSM',
    icon: '🛒',
    color: '#0070d2',
    description: 'Coupa Business Spend Management — Procurement, Invoicing, Sourcing & Supply Chain',
    workItemTypes: ['Implementation', 'Integration', 'Configuration', 'Data Migration', 'Optimization', 'Supplier Enablement'],
    terminology: {
      transport: 'Configuration Item',
      pipeline: 'Deployment Pipeline',
      system: 'Coupa Tenant',
      environments: 'Sandbox → Staging → Production',
      workItem: 'Deliverable',
    },
    phases: ['Design', 'Configure', 'Build', 'Test', 'Deploy', 'Optimize'],
  },
  commercial: {
    key: 'commercial',
    name: 'Life Sciences Commercial',
    shortName: 'Life Sciences',
    icon: '💊',
    color: '#722ed1',
    description: 'Life Sciences Commercial Operations — Product Launches, Campaigns, Compliance & Field Force',
    workItemTypes: ['Product Launch', 'Campaign', 'Compliance Initiative', 'Market Access', 'Field Force', 'MLR Review'],
    terminology: {
      transport: 'Deliverable',
      pipeline: 'Delivery Pipeline',
      system: 'Platform',
      environments: 'Dev → Staging → Production',
      workItem: 'Initiative',
    },
    phases: ['Planning', 'Pre-Launch', 'Execution', 'Monitoring', 'Close-Out'],
  },
};

interface ModuleContextType {
  activeModule: ModuleKey;
  setActiveModule: (key: ModuleKey) => void;
  moduleDef: ModuleDefinition;
  allModules: ModuleDefinition[];
}

const ModuleContext = createContext<ModuleContextType>({
  activeModule: 'sap',
  setActiveModule: () => {},
  moduleDef: MODULE_DEFINITIONS.sap,
  allModules: Object.values(MODULE_DEFINITIONS),
});

export const useModule = () => useContext(ModuleContext);

export const ModuleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeModule, setActiveModule] = useState<ModuleKey>(() => {
    return (localStorage.getItem('pcc_active_module') as ModuleKey) || 'sap';
  });

  useEffect(() => {
    localStorage.setItem('pcc_active_module', activeModule);
  }, [activeModule]);

  const value: ModuleContextType = {
    activeModule,
    setActiveModule,
    moduleDef: MODULE_DEFINITIONS[activeModule],
    allModules: Object.values(MODULE_DEFINITIONS),
  };

  return <ModuleContext.Provider value={value}>{children}</ModuleContext.Provider>;
};
