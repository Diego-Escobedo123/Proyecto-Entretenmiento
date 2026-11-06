import { defineConfig, devices } from '@playwright/test'

/**
 * Pruebas e2e con Playwright (EXP-075 / EXP-076).
 *
 * Playwright levanta solo lo que necesita:
 *   - la API en el puerto 3100 contra la base de pruebas (backend: `bun run e2e:server`)
 *   - el frontend en el puerto 5174 apuntando a esa API
 * Puertos distintos a los de desarrollo (3000 / 5173) para no chocar con ellos.
 *
 * Requisito: TEST_DATABASE_URL en backend/.env (o en CI) y Postgres corriendo.
 */
const API_PORT = 3100
const WEB_PORT = 5174
const isCI = !!process.env.CI

export default defineConfig({
  testDir: './e2e',
  // Comparten una sola base: una prueba a la vez, en orden.
  workers: 1,
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'bun run e2e:server',
      cwd: '../backend',
      url: `http://localhost:${API_PORT}/health`,
      reuseExistingServer: !isCI,
      timeout: 120_000,
      env: { E2E_API_PORT: String(API_PORT), E2E_WEB_ORIGIN: `http://localhost:${WEB_PORT}` },
    },
    {
      command: `bunx vite --port ${WEB_PORT} --strictPort`,
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: !isCI,
      timeout: 120_000,
      stdout: 'ignore',
      stderr: 'ignore',
      // Gana sobre frontend/.env.local: sin analítica ni Google en las pruebas.
      env: { VITE_API_URL: `http://localhost:${API_PORT}`, VITE_POSTHOG_KEY: '', VITE_GOOGLE_CLIENT_ID: '' },
    },
  ],
})
