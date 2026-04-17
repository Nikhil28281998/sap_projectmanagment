import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider, theme } from 'antd';
import App from './App';
import './styles/utilities.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      // H2 FIX: Disable global refetch-on-window-focus.
      // Dashboard pages have 8+ queries — refetching all of them on every tab switch
      // causes 8 concurrent API calls and visible loading flicker.
      // Hooks that genuinely need fresh data (notifications) override this per-query.
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      {/*
        H8 FIX: ConfigProvider now properly sets the design tokens.
        colorPrimary was previously a no-op because the default Ant Design blue is #1677ff.
        Set to the brand blue used across all dashboards so theme is consistent.
        Additional component tokens override default Ant Design styles globally.
      */}
      <ConfigProvider
        theme={{
          algorithm: theme.defaultAlgorithm,
          token: {
            colorPrimary: '#1677ff',
            colorSuccess: '#52c41a',
            colorWarning: '#faad14',
            colorError: '#ff4d4f',
            borderRadius: 6,
            fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif",
          },
          components: {
            Table: {
              // Enable virtual scrolling-ready styles
              rowSelectedBg: '#e6f4ff',
            },
            Button: {
              borderRadius: 6,
            },
            Card: {
              borderRadius: 8,
            },
          },
        }}
      >
        <App />
      </ConfigProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
