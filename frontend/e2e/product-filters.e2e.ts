import { expect, test } from '@playwright/test';
import { TestProduct, createProduct, deleteProducts, uniqueSku } from './support/products';

test.describe('filtros del listado', () => {
  const prefix = uniqueSku('FILTER');
  let lowStockOffice: TestProduct;
  let wellStockedFurniture: TestProduct;

  test.beforeAll(async ({ request }) => {
    lowStockOffice = await createProduct(request, `${prefix}-A`, {
      name: `${prefix} lámpara`,
      categoryId: 2,
      stock: 1,
      minStock: 5,
    });
    wellStockedFurniture = await createProduct(request, `${prefix}-B`, {
      name: `${prefix} estantería`,
      categoryId: 3,
      stock: 50,
      minStock: 5,
    });
  });

  test.afterAll(async ({ request }) => {
    await deleteProducts(request, lowStockOffice.id, wellStockedFurniture.id);
  });

  test('busca, filtra por categoría y por stock bajo', async ({ page }) => {
    await page.goto('/products');
    const rows = page.locator('tbody tr');

    await page.getByRole('searchbox', { name: 'Buscar' }).fill(prefix);
    await expect(rows).toHaveCount(2);
    await expect(page.locator('.pagination')).toContainText('2 productos');

    await page.getByLabel('Categoría').selectOption({ label: 'Furniture' });
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText(wellStockedFurniture.sku);
    await expect(page.locator('.pagination')).toContainText('1 producto');

    await page.getByLabel('Categoría').selectOption({ label: 'Todas' });
    await page.getByLabel('Solo stock bajo').check();
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText(lowStockOffice.sku);
    await expect(rows.first()).toContainText('Stock bajo');
  });
});
