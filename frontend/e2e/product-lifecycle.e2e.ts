import { expect, test } from '@playwright/test';
import { deleteProducts, uniqueSku } from './support/products';

test('ciclo completo: crear, editar y eliminar un producto', async ({ page, request }) => {
  const sku = uniqueSku('LIFE');
  const name = `Producto e2e ${sku}`;
  let createdId: number | undefined;

  try {
    // Crear (SKU en minúsculas y con espacios: la app lo normaliza)
    await page.goto('/products/new');
    await page.getByLabel('SKU *').fill(` ${sku.toLowerCase()} `);
    await page.getByLabel('Nombre *').fill(name);
    await page.getByLabel('Categoría *').selectOption({ label: 'Office' });
    await page.getByLabel('Precio (€) *').fill('15.5');
    await page.getByLabel('Stock *', { exact: true }).fill('2');
    await page.getByLabel('Stock mínimo *').fill('5');
    await page.getByRole('button', { name: 'Crear producto' }).click();

    await expect(page).toHaveURL(/\/products$/);
    await expect(page.getByText(`Producto ${sku} creado.`)).toBeVisible();

    await page.getByRole('searchbox', { name: 'Buscar' }).fill(sku);
    const row = page.getByRole('row', { name: new RegExp(sku) });
    await expect(row).toBeVisible();
    await expect(row).toContainText('15,50 €');
    await expect(row).toContainText('Stock bajo');
    createdId = Number((await row.getByRole('link', { name: /Editar/ }).getAttribute('href'))?.split('/')[2]);

    // Editar: con stock por encima del mínimo deja de estar en stock bajo
    await row.getByRole('link', { name: /Editar/ }).click();
    await expect(page.getByLabel('Nombre *')).toHaveValue(name);
    await page.getByLabel('Stock *', { exact: true }).fill('30');
    await page.getByRole('button', { name: 'Guardar cambios' }).click();

    await expect(page.getByText(`Producto ${sku} guardado.`)).toBeVisible();
    await page.getByRole('searchbox', { name: 'Buscar' }).fill(sku);
    await expect(row).toContainText('30');
    await expect(row).not.toContainText('Stock bajo');

    // Eliminar aceptando la confirmación
    page.once('dialog', (dialog) => dialog.accept());
    await row.getByRole('button', { name: /Eliminar/ }).click();

    await expect(page.getByText(`Producto ${sku} eliminado.`)).toBeVisible();
    await expect(page.getByText('No hay productos que coincidan con los filtros.')).toBeVisible();
  } finally {
    // Limpieza por si el test falla a mitad
    if (createdId) {
      await deleteProducts(request, createdId);
    }
  }
});
