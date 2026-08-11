import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { encounterAuthoringVitePlugin } from './scripts/encounter-authoring-bridge.mjs';

export default defineConfig({
  base: '/Dread_Stone_Black/',
  plugins: [react(), encounterAuthoringVitePlugin()],
});
