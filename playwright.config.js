// @ts-check
import { defineConfig, devices } from '@playwright/test';

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/setup/auth.setup.js',
  timeout: 120000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    storageState: 'e2e/.auth/user.json',
    /* The dev site sits behind HTTP Basic at the CDN, so pointing the suite at it needs
       credentials before anything else can load. Unset for production, where there is no
       such gate — an `undefined` here is the same as not setting it. */
    httpCredentials: process.env.BASIC_AUTH_USER
      ? { username: process.env.BASIC_AUTH_USER, password: process.env.BASIC_AUTH_PASS || '' }
      : undefined,
    trace: 'on',
    screenshot: 'on',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
