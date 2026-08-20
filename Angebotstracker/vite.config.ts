import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // `npm run dev` talks to the local uvicorn API; in production Vercel
    // routes /api to the serverless function on the same origin.
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
});
