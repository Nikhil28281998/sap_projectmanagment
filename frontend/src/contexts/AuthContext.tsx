import React, { createContext, useContext } from 'react';
import { useCurrentUser } from '../hooks/useData';
import { Spin, Result, Button } from 'antd';

export interface UserInfo {
  email: string;
  name: string;
  roles: string[];
  isAdmin: boolean;
  isManager: boolean;
  isDeveloper: boolean;
  isExecutive: boolean;
  isSuperAdmin: boolean;
  allowedApps: string[];
}

interface AuthContextType {
  user: UserInfo | null;
  isLoading: boolean;
  hasRole: (role: string) => boolean;
  hasAnyRole: (...roles: string[]) => boolean;
  canWrite: boolean;       // Admin or Manager
  canConfigure: boolean;   // Admin only
  canViewReports: boolean; // Admin, Manager, Executive
  isSuperAdmin: boolean;
  allowedApps: string[];
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  hasRole: () => false,
  hasAnyRole: () => false,
  canWrite: false,
  canConfigure: false,
  canViewReports: false,
  isSuperAdmin: false,
  allowedApps: [],
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { data: user, isLoading, error } = useCurrentUser();

  const hasRole = (role: string) => user?.roles?.includes(role) ?? false;
  const hasAnyRole = (...roles: string[]) => roles.some(r => hasRole(r));

  const value: AuthContextType = {
    user: user ?? null,
    isLoading,
    hasRole,
    hasAnyRole,
    canWrite: hasRole('Admin') || hasRole('Manager'),
    canConfigure: hasRole('Admin'),
    canViewReports: hasAnyRole('Admin', 'Manager', 'Executive'),
    isSuperAdmin: user?.isSuperAdmin ?? false,
    allowedApps: user?.allowedApps ?? [],
  };

  if (isLoading) {
    return (
      <div className="auth-loading">
        <Spin size="large" tip="Loading..." />
      </div>
    );
  }

  if (error) {
    return (
      <Result
        status="403"
        title="Authentication Required"
        subTitle="Unable to verify your identity. Please check your credentials or contact your administrator."
        extra={<Button type="primary" onClick={() => window.location.reload()}>Retry</Button>}
      />
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
