import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development the React app (5173) proxies /api and /uploads to the Express API (5000),
// so no CORS setup is needed and image URLs just work.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:5000',
      '/uploads': 'http://localhost:5000',
    },
  },
});
