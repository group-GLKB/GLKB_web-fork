// @ts-check
import { defineConfig, devices } from '@playwright/test';

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/setup/auth.setup.js',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    storageState: 'e2e/.auth/user.json',
    trace: 'on-first-retry',
    httpCredentials: process.env.AMPLIFY_USERNAME ? {
      username: process.env.AMPLIFY_USERNAME,
      password: process.env.AMPLIFY_PASSWORD || '',
    } : undefined,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
