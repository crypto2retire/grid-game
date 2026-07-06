import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.GRID_E2E_BASE_URL || 'https://grid-game-pom3.onrender.com';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
