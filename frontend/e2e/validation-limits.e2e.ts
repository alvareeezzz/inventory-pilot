import { APIRequestContext, expect, test } from '@playwright/test';
import { deleteProducts, uniqueSku } from './support/products';

/**
 * Comprueba que el formulario y la API aplican los mismos límites: si se cambia uno en un lado y no
 * en el otro, este test falla.
 */
const LIMITS = {
  sku: { max: 32, message: 'El SKU no puede superar los 32 caracteres.' },
  name: { max: 100, message: 'El nombre no puede superar los 100 caracteres.' },
  description: { max: 500, message: 'La descripción no puede superar los 500 caracteres.' },
};
const MAX_AMOUNT = 1_000_000;
const SEARCH_MAX = 100;

async function post(request: APIRequestContext, overrides: Record<string, unknown>) {
  return request.post('/api/products', {
    data: { sku: uniqueSku('LIM'), name: 'Producto límites e2e', categoryId: 1, price: 10, stock: 1, minStock: 0, ...overrides },
  });
}

test.describe('límites de validación', () => {
  test('la API acepta el máximo de cada texto y rechaza uno más, con el límite en el mensaje', async ({ request }) => {
    for (const [field, { max, message }] of Object.entries(LIMITS)) {
      // Un SKU distinto en cada prueba para no chocar con el índice único.
      const atLimit = field === 'sku' ? uniqueSku('L').padEnd(max, 'X') : 'x'.repeat(max);
      const accepted = await post(request, { [field]: atLimit });
      expect(accepted.status(), `${field} con ${max} caracteres`).toBe(201);
      await deleteProducts(request, (await accepted.json()).id);

      const rejected = await post(request, { [field]: 'X'.repeat(max + 1) });
      expect(rejected.status(), `${field} con ${max + 1} caracteres`).toBe(400);
      const errors: Record<string, string[]> = (await rejected.json()).errors;
      expect(errors[field.charAt(0).toUpperCase() + field.slice(1)]).toEqual([message]);
    }

    for (const field of ['price', 'stock', 'minStock']) {
      const accepted = await post(request, { [field]: MAX_AMOUNT });
      expect(accepted.status(), `${field} = ${MAX_AMOUNT}`).toBe(201);
      await deleteProducts(request, (await accepted.json()).id);

      const rejected = await post(request, { [field]: MAX_AMOUNT + 1 });
      expect(rejected.status(), `${field} = ${MAX_AMOUNT + 1}`).toBe(400);
      expect(JSON.stringify((await rejected.json()).errors)).toContain('1.000.000');
    }
  });

  test('la búsqueda del listado tiene el mismo límite en el campo y en la API', async ({ page, request }) => {
    expect((await request.get(`/api/products?search=${'x'.repeat(SEARCH_MAX)}`)).status()).toBe(200);
    const rejected = await request.get(`/api/products?search=${'x'.repeat(SEARCH_MAX + 1)}`);
    expect(rejected.status()).toBe(400);
    expect(JSON.stringify((await rejected.json()).errors)).toContain(`${SEARCH_MAX} caracteres`);

    await page.goto('/products');
    await expect(page.getByRole('searchbox', { name: 'Buscar' })).toHaveAttribute('maxlength', String(SEARCH_MAX));
  });

  test('el formulario limita los textos y los importes a los mismos valores', async ({ page }) => {
    await page.goto('/products/new');

    await expect(page.getByLabel('SKU *')).toHaveAttribute('maxlength', String(LIMITS.sku.max));
    await expect(page.getByLabel('Nombre *')).toHaveAttribute('maxlength', String(LIMITS.name.max));
    await expect(page.getByLabel('Descripción')).toHaveAttribute('maxlength', String(LIMITS.description.max));

    await page.getByLabel('Precio (€) *').fill(String(MAX_AMOUNT + 1));
    await page.getByLabel('Stock *', { exact: true }).fill(String(MAX_AMOUNT + 1));
    await page.getByRole('button', { name: 'Crear producto' }).click();
    await expect(page.locator('#price-error')).toHaveText('El valor máximo es 1.000.000.');
    await expect(page.locator('#stock-error')).toHaveText('El valor máximo es 1.000.000.');
  });
});
