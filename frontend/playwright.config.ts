import { defineConfig, devices } from '@playwright/test';

/**
 * Tests e2e: arrancan la API (.NET) y el frontend si no están ya en marcha
 * y trabajan contra la base de datos de desarrollo (InventoryPilot en LocalDB).
 * Cada test crea y borra sus propios datos.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      // Usa el Google Chrome instalado en el equipo: no hace falta descargar navegadores.
      name: 'chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],
  webServer: [
    {
      command: 'dotnet run --project ../backend/src/Inventory.Api --launch-profile https',
      url: 'https://localhost:7080/health',
      ignoreHTTPSErrors: true,
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: 'npm start',
      url: 'http://localhost:4200',
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
