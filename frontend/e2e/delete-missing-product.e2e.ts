import { expect, test } from '@playwright/test';
import { createProduct, deleteProducts, uniqueSku } from './support/products';

test('eliminar un producto que ya no existe avisa y lo quita del listado', async ({ page, request }) => {
  const sku = uniqueSku('GONE');
  const product = await createProduct(request, sku, { name: `Producto e2e ${sku}` });

  await page.goto('/products');
  await page.getByRole('searchbox', { name: 'Buscar' }).fill(sku);
  const row = page.getByRole('row', { name: new RegExp(sku) });
  await expect(row).toBeVisible();
  // Espera a que se aplique la búsqueda (va con retardo): solo debe quedar la fila del producto.
  await expect(page.locator('tbody tr')).toHaveCount(1);

  // Otra persona lo borra mientras tenemos el listado abierto.
  await deleteProducts(request, product.id);

  page.once('dialog', (dialog) => dialog.accept());
  await row.getByRole('button', { name: /Eliminar/ }).click();

  await expect(page.getByRole('alert')).toContainText(`No existe ningún producto con el id ${product.id}.`);
  await expect(row).toHaveCount(0);
  await expect(page.getByText('No hay productos que coincidan con los filtros.')).toBeVisible();
});
