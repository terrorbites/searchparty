import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: { outDir: 'release-upload', emptyOutDir: true, sourcemap: false },
  server: { host: '127.0.0.1', port: 5174, proxy: { '/api': 'http://127.0.0.1:8088' } },
});
