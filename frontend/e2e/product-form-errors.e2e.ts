import { expect, test } from '@playwright/test';
import { createProduct, deleteProducts, uniqueSku } from './support/products';

test.describe('errores del formulario', () => {
  test('no envía un formulario vacío y explica cada error', async ({ page }) => {
    await page.goto('/products/new');
    await page.getByRole('button', { name: 'Crear producto' }).click();

    await expect(page).toHaveURL(/\/products\/new$/);
    await expect(page.locator('#sku-error')).toHaveText('Este campo es obligatorio.');
    await expect(page.locator('#name-error')).toHaveText('Este campo es obligatorio.');
    await expect(page.locator('#category-error')).toHaveText('Selecciona una categoría.');
    await expect(page.locator('#price-error')).toHaveText('El valor mínimo es 0,01.');
  });

  test('avisa si el SKU ya existe', async ({ page, request }) => {
    const existing = await createProduct(request, uniqueSku('DUP'), { name: 'Producto existente e2e' });

    try {
      await page.goto('/products/new');
      await page.getByLabel('SKU *').fill(existing.sku.toLowerCase());
      await page.getByLabel('Nombre *').fill('Intento duplicado');
      await page.getByLabel('Categoría *').selectOption({ label: 'Office' });
      await page.getByLabel('Precio (€) *').fill('5');
      await page.getByRole('button', { name: 'Crear producto' }).click();

      await expect(page.locator('#sku-error')).toHaveText('Ya existe un producto con este SKU.');
      await expect(page).toHaveURL(/\/products\/new$/);
    } finally {
      await deleteProducts(request, existing.id);
    }
  });

  test('editar un producto inexistente muestra un aviso sin formulario', async ({ page }) => {
    await page.goto('/products/999999/edit');

    await expect(page.getByRole('alert')).toHaveText('El producto no existe o ha sido eliminado.');
    await expect(page.locator('form')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Volver al listado' })).toBeVisible();
  });
});
