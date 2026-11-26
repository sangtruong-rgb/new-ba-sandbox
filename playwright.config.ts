import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PORT) || 5173;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

// A database of its own, deleted and migrated each time the server starts. Set here so the
// test workers (e2e/support/fixtures.ts) write to the same file the server reads.
const DATABASE_URL = path.resolve('e2e/.tmp/e2e.sqlite');
process.env.DATABASE_URL = DATABASE_URL;

export default defineConfig({
  testDir: 'e2e',
  reporter: 'json',
  fullyParallel: true,
  use: {
    baseURL: BASE_URL,
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh',
    ...devices['Desktop Chrome'],
    viewport: { width: 1440, height: 1000 },
  },
  webServer: {
    command: 'node server/db/fresh.ts && npx vite',
    url: `${BASE_URL}/api/health`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: { PORT: String(PORT), DATABASE_URL },
  },
});
