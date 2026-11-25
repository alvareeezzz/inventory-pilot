import { expect, test } from '@playwright/test';
import { deleteProducts, uniqueSku } from './support/products';

test('el aviso de producto creado no reaparece al recargar la página', async ({ page, request }) => {
  const sku = uniqueSku('RELOAD');
  let createdId: number | undefined;

  try {
    await page.goto('/products/new');
    await page.getByLabel('SKU *').fill(sku);
    await page.getByLabel('Nombre *').fill(`Producto e2e ${sku}`);
    await page.getByLabel('Categoría *').selectOption({ label: 'Office' });
    await page.getByLabel('Precio (€) *').fill('10');
    const created = page.waitForResponse((res) => res.url().endsWith('/api/products') && res.request().method() === 'POST');
    await page.getByRole('button', { name: 'Crear producto' }).click();
    createdId = (await (await created).json()).id;

    const message = page.getByText(`Producto ${sku} creado.`);
    await expect(message).toBeVisible();

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Productos' })).toBeVisible();
    await expect(page.locator('tbody tr').first()).toBeVisible();
    await expect(message).toHaveCount(0);
  } finally {
    if (createdId) {
      await deleteProducts(request, createdId);
    }
  }
});
