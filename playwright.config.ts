import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 45000,
  use: {
    baseURL: 'http://localhost:4173/TowerDefense/',
    viewport: { width: 1366, height: 768 },
  },
  webServer: {
    command: 'npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173/TowerDefense/',
    reuseExistingServer: true,
    timeout: 20000,
  },
});
