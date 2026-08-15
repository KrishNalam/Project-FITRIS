import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './', // relative asset paths: works at a domain root or under /Project-FITRIS/
  test: { environment: 'jsdom', globals: true },
});
