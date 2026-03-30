import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:4004',
        changeOrigin: true,
        // Forward Basic auth header for CAP mocked auth
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            // Auto-inject mocked auth for development
            const auth = Buffer.from('manager@test.com:pass').toString('base64');
            proxyReq.setHeader('Authorization', `Basic ${auth}`);
          });
        },
      },
    },
  },
  build: {
    outDir: '../approuter/webapp',
    emptyOutDir: true,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
});
