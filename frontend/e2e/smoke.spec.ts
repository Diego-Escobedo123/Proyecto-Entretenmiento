import { expect, test } from '@playwright/test'

// Prueba de ejemplo (EXP-075): la app abre en el navegador y, sin sesión,
// manda a la pantalla de inicio de sesión.
test('sin sesión, la app manda al inicio de sesión', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByRole('heading', { name: 'Inicia sesión' })).toBeVisible()
})
