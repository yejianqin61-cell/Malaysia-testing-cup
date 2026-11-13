// Smoke / regression config. Set SUT_URL (and optionally AUTH=auth.json) before running:
//   PowerShell:  $env:SUT_URL="https://sut.example.com"; npx playwright test
import { defineConfig, devices } from '@playwright/test';
import fs from 'node:fs';

const auth = process.env.AUTH && fs.existsSync(process.env.AUTH) ? process.env.AUTH : undefined;

export default defineConfig({
  testDir: './tests',
  outputDir: 'out/test-results',
  workers: 1,            // sequential: never hammer the shared SUT
  retries: 0,            // a flaky result is information; reproduce manually instead
  timeout: 60_000,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'out/smoke-report', open: 'never' }],
    ['json', { outputFile: 'out/smoke-results.json' }],
  ],
  use: {
    baseURL: process.env.SUT_URL,
    storageState: auth,
    screenshot: 'on',      // evidence for every case
    trace: 'retain-on-failure',
    video: 'off',
  },
  projects: [
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 } } },
    // Enable when needed (doubles the load on the SUT):
    // { name: 'firefox-desktop', use: { ...devices['Desktop Firefox'] } },
    // { name: 'chromium-mobile', use: { ...devices['Pixel 7'] } },
  ],
});
