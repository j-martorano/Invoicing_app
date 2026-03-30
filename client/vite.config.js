import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
      '/invoices': 'http://localhost:3001',
      '/public': 'http://localhost:3001',
    },
  },
});
