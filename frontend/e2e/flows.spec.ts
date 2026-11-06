import { expect, test, type Page } from '@playwright/test'
import { DUNE, createUser, loginAs, mockCatalog, newUser } from './helpers.ts'

/**
 * Flujos críticos de punta a punta (EXP-076): el navegador usa la app como
 * una persona, contra la API y la base de pruebas reales.
 */

test.describe('login', () => {
  test('crear cuenta, cerrar sesión y volver a entrar', async ({ page }) => {
    const user = newUser('Ana Prueba')

    await page.goto('/register')
    await page.getByLabel('Nombre').fill(user.name)
    await page.getByLabel('Correo').fill(user.email)
    await page.getByLabel('Contraseña', { exact: true }).fill(user.password)
    await page.getByLabel('Confirmar contraseña').fill(user.password)
    await page.getByRole('button', { name: 'Crear cuenta' }).click()
    await expect(page).toHaveURL('/')
    await expect(page.getByText(user.name).first()).toBeVisible()

    await page.evaluate(() => localStorage.clear())
    await page.goto('/login')
    await page.getByLabel('Correo').fill(user.email)
    await page.getByLabel('Contraseña').fill(user.password)
    await page.getByRole('button', { name: 'Iniciar sesión' }).click()
    await expect(page).toHaveURL('/')
  })

  test('con contraseña incorrecta muestra el error y no entra', async ({ page }) => {
    const user = await createUser(page)
    await page.goto('/login')
    await page.getByLabel('Correo').fill(user.email)
    await page.getByLabel('Contraseña').fill('no-es-esta')
    await page.getByRole('button', { name: 'Iniciar sesión' }).click()
    await expect(page.getByText('Correo o contraseña incorrectos.')).toBeVisible()
    await expect(page).toHaveURL(/\/login/)
  })
})

test.describe('búsqueda', () => {
  test('buscar una obra muestra el resultado del catálogo', async ({ page }) => {
    await mockCatalog(page)
    await loginAs(page, await createUser(page))

    await page.getByRole('combobox', { name: 'Buscar' }).fill('Dune')
    const result = page.getByRole('listbox').getByRole('button', { name: /Dune/ })
    await expect(result).toBeVisible()
    await expect(result).toContainText('Denis Villeneuve')
  })
})

/** Abre "+ Agregar obra", busca Dune y la elige de las sugerencias. */
async function addDune(page: Page, { review, stars }: { review?: string; stars?: number } = {}) {
  await page.getByRole('button', { name: '+ Agregar obra' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Tipo').selectOption('movie')
  await dialog.getByLabel('Título').fill('Dune')
  await dialog.getByRole('button', { name: /Dune/ }).click()
  await dialog.getByLabel('Estado').selectOption('completed')

  if (stars) {
    const rating = dialog.getByRole('slider', { name: 'Calificación' })
    await rating.focus()
    await rating.press('End') // 5 estrellas
    for (let s = 5; s > stars; s -= 0.5) await rating.press('ArrowLeft')
    await expect(rating).toHaveAttribute('aria-valuenow', String(stars))
  }
  if (review) await dialog.getByLabel('Tu reseña').fill(review)

  await dialog.getByRole('button', { name: 'Agregar obra' }).click()
  await expect(dialog).toBeHidden()
}

test.describe('registrar obra', () => {
  test('agregar una película la deja en Mi colección', async ({ page }) => {
    await mockCatalog(page)
    await loginAs(page, await createUser(page))

    await addDune(page)

    await page.getByRole('link', { name: 'Mi colección' }).click()
    await expect(page).toHaveURL('/collection')
    await expect(page.getByText(DUNE.title, { exact: true }).first()).toBeVisible()
  })
})

test.describe('reseñas', () => {
  test('una reseña publicada la ve otra persona en la ficha de la obra', async ({ page, browser }) => {
    // Nombre y texto únicos: si la base ya tiene reseñas de otras corridas, no se confunden.
    const ana = newUser(`Ana Reseña ${Date.now() % 100000}`)
    const text = `Una obra maestra visual (${Date.now()}).`
    await mockCatalog(page)
    await loginAs(page, await createUser(page, ana))
    await addDune(page, { stars: 4.5, review: text })

    // Otra persona busca la misma obra y abre su ficha.
    const context = await browser.newContext()
    const other = await context.newPage()
    await mockCatalog(other)
    await loginAs(other, await createUser(other, newUser('Beto Prueba')))
    await other.getByRole('combobox', { name: 'Buscar' }).fill('Dune')
    await other.getByRole('listbox').getByRole('button', { name: /Dune/ }).click()

    const detail = other.getByRole('dialog')
    await expect(detail.getByText(text)).toBeVisible()
    await expect(detail.getByText(ana.name)).toBeVisible()
    await context.close()
  })
})
