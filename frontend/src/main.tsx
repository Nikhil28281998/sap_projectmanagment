import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { ThemeProvider } from './design/theme';
import './design/global.css';
import './styles/utilities.css';

// Phase 3 cleanup: remove legacy dashboard view toggle keys (no longer used)
try {
  ['sap_dashboard_view', 'coupa_dashboard_view', 'commercial_dashboard_view', 'exec_dashboard_view']
    .forEach((k) => localStorage.removeItem(k));
} catch { /* localStorage unavailable in SSR/private mode */ }

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
