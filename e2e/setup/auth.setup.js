import { chromium } from '@playwright/test';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const AUTH_FILE = 'e2e/.auth/user.json';

// Load .env manually (Playwright global setup runs outside CRA)
function loadEnv() {
  try {
    const envPath = resolve(process.cwd(), '.env');
    const lines = readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      const [key, ...rest] = line.split('=');
      if (key && rest.length) process.env[key.trim()] = rest.join('=').trim();
    }
  } catch {
    // .env not found, rely on shell env vars
  }
}

async function globalSetup() {
  loadEnv();

  const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
  const token = process.env.TEST_TOKEN;
  if (!token) {
    throw new Error('TEST_TOKEN env var must be set (see .env file)');
  }

  // Decode user info from JWT payload (no verification needed here)
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
  const user = { id: payload.sub, email: payload.email };

  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL: BASE_URL });
  const page = await context.newPage();
  await page.goto('/');
  await page.evaluate(({ token, user }) => {
    localStorage.setItem('access_token', token);
    localStorage.setItem('token_type', 'bearer');
    localStorage.setItem('user', JSON.stringify(user));
  }, { token, user });
  await context.storageState({ path: AUTH_FILE });
  await browser.close();
}

export default globalSetup;
