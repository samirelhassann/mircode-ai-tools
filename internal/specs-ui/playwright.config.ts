import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  use: {
    baseURL: process.env.SPECS_BASE_URL ?? 'http://localhost:4321',
    headless: false,
    screenshot: 'only-on-failure',
    viewport: { width: 1440, height: 900 },
  },
  reporter: [['list']],
  fullyParallel: false,
  workers: 1,
})
