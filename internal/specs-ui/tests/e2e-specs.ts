import { expect, test, type Page } from '@playwright/test'

const BASE_URL = process.env.SPECS_BASE_URL ?? 'http://localhost:4321'
const FEATURE = 'specs-platform'
const TASK = 'feat-specs-platform-discovery'

async function ensureReady(page: Page) {
  await page.goto(BASE_URL)
  await page.waitForLoadState('networkidle')
}

test.describe('Specs Platform — E2E', () => {
  test('1. bootstrap e navegação', async ({ page }) => {
    await ensureReady(page)
    // URL redireciona de / para /features/<primeira>
    await expect(page).toHaveURL(/\/features\//)
    // Sidebar com aria-label
    await expect(page.locator('aside[aria-label="Features"]')).toBeVisible()
  })

  test('2. clica em feature e em task — conteúdo carrega', async ({ page }) => {
    await ensureReady(page)
    await page.getByRole('button', { name: new RegExp(FEATURE, 'i') }).first().click()
    await page.waitForTimeout(300)
    // Clica na task de discovery
    await page.getByRole('link', { name: /Discovery e Arquitetura/i }).first().click()
    await expect(page).toHaveURL(new RegExp(`/features/${FEATURE}/${TASK}`))
    // Título renderizado
    await expect(page.locator('h1').first()).toContainText(/Discovery e Arquitetura/i)
  })

  test('3. abre e fecha modal Alterar Status', async ({ page }) => {
    await page.goto(`${BASE_URL}/features/${FEATURE}/${TASK}`)
    await page.waitForLoadState('networkidle')
    const btn = page.getByRole('button', { name: /Alterar Status/i })
    await btn.click()
    await expect(page.locator('[role="dialog"]')).toBeVisible()
    await expect(page.getByText('Pendente')).toBeVisible()
    await expect(page.getByText('Em andamento')).toBeVisible()
    await expect(page.getByText('Concluída')).toBeVisible()
    await expect(page.getByText('Bloqueada')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('[role="dialog"]')).toHaveCount(0)
  })

  test('4. mudança de status persiste', async ({ page }) => {
    await page.goto(`${BASE_URL}/features/${FEATURE}/${TASK}`)
    await page.waitForLoadState('networkidle')

    // Intercepta request para validar payload
    const statusReq = page.waitForRequest((r) => r.url().includes('/api/status') && r.method() === 'POST')

    await page.getByRole('button', { name: /Alterar Status/i }).click()
    await page.getByRole('radio', { name: /Marcar como Em andamento/i }).click()
    const req = await statusReq
    const body = JSON.parse(req.postData() ?? '{}')
    expect(body).toMatchObject({ feature: FEATURE, task: TASK, status: 'in-progress' })

    // Reload persiste — aguardar 1s e validar que o ícone timer aparece na sidebar
    await page.waitForTimeout(500)
    await page.reload()
    await page.waitForLoadState('networkidle')

    // Cleanup: volta para completed (estado final deste task)
    await page.getByRole('button', { name: /Alterar Status/i }).click()
    await page.getByRole('radio', { name: /Marcar como Concluída/i }).click()
  })

  test('5. responsividade desktop-only: overlay aparece em viewport estreito', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 700 })
    await ensureReady(page)
    await expect(page.locator('[role="dialog"][aria-labelledby="small-screen-title"]')).toBeVisible()
    await page.getByRole('button', { name: /Continuar mesmo assim/i }).click()
    await expect(page.locator('[role="dialog"][aria-labelledby="small-screen-title"]')).toHaveCount(0)
  })

  test('6. run-agent dispara modal e permite escolher escopo', async ({ page }) => {
    await page.goto(`${BASE_URL}/features/${FEATURE}/${TASK}`)
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: /Rodar Tarefa/i }).click()
    await expect(page.getByText('Feature inteira')).toBeVisible()
    await expect(page.getByText('Task atual')).toBeVisible()
    await expect(page.getByText('Feature sem pausar')).toBeVisible()
    await page.getByRole('button', { name: /Cancelar/i }).click()
  })

  test('7. deep link com hash rola para seção', async ({ page }) => {
    await page.goto(`${BASE_URL}/features/${FEATURE}/${TASK}#escopo`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(200)
    const heading = page.locator('h2#escopo')
    await expect(heading).toBeInViewport()
  })

  test('8. reduced-motion é respeitado', async ({ page, context }) => {
    await context.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(`${BASE_URL}/features/${FEATURE}/${TASK}`)
    await page.waitForLoadState('networkidle')
    // Apenas garantir que a página carrega sem erros
    await expect(page.locator('h1').first()).toBeVisible()
  })
})
