import React, { createContext, useContext, useState, useEffect } from 'react';

export type ModuleKey = 'sap';

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
