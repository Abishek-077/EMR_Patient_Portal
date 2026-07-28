import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './frontend/tests',
  timeout: 45_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:53917',
    channel: 'chrome',
    viewport: { width: 1440, height: 1000 },
    locale: 'en-NP',
    timezoneId: 'Asia/Kathmandu',
    colorScheme: 'light',
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'PORT=43991 ALLOWED_ORIGINS=http://127.0.0.1:53917 npm start',
      url: 'http://127.0.0.1:43991/api/health',
      timeout: 120_000,
      reuseExistingServer: false,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: 'VITE_PORT=53917 VITE_API_PROXY_TARGET=http://127.0.0.1:43991 npm run dev:web',
      url: 'http://127.0.0.1:53917/api/health',
      timeout: 120_000,
      reuseExistingServer: false,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
});
