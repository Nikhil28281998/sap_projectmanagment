import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Dev proxy user — override via VITE_DEV_USER env var (default: admin@test.com)
const devUser = process.env.VITE_DEV_USER || 'admin@test.com';
const devPass = process.env.VITE_DEV_PASS || 'pass';

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
            const auth = Buffer.from(`${devUser}:${devPass}`).toString('base64');
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
