import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In dev the browser only ever talks to Vite (:5173); /api is proxied to Express (:4000).
// The Groq key therefore never touches the browser — it lives in server/.env.
export default defineConfig({
  base: process.env.BASE_URL || '/',
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    proxy: { '/api': { target: 'http://localhost:4000', changeOrigin: false, ws: false } },
  },
  build: { chunkSizeWarningLimit: 900 },
});
