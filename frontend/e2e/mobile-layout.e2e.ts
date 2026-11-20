import { expect, test } from '@playwright/test';
import { TestProduct, createProduct, deleteProducts, uniqueSku } from './support/products';

// Ancho de un móvil pequeño (iPhone SE / 13 mini).
test.use({ viewport: { width: 375, height: 812 } });

test.describe('vista móvil', () => {
  const sku = uniqueSku('MOBILE');
  let product: TestProduct;

  test.beforeAll(async ({ request }) => {
    // Producto propio para que la tabla tenga filas aunque la base de datos esté vacía.
    product = await createProduct(request, sku, {
      name: `${sku} producto con un nombre bastante largo`,
      price: 1234.5,
      stock: 2,
      minStock: 5,
    });
  });

  test.afterAll(async ({ request }) => {
    await deleteProducts(request, product.id);
  });

  test('el listado no provoca scroll horizontal en la página', async ({ page }) => {
    await page.goto('/products');
    await page.getByRole('searchbox', { name: 'Buscar' }).fill(sku);
    await expect(page.getByRole('cell', { name: sku, exact: true })).toBeVisible();

    // La página no debe ser más ancha que la pantalla.
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });

  test('cada producto se ve completo, con precio, stock y acciones, sin desplazar en horizontal', async ({ page }) => {
    await page.goto('/products');
    await page.getByRole('searchbox', { name: 'Buscar' }).fill(sku);
    const row = page.getByRole('row', { name: new RegExp(sku) });
    await expect(row).toBeVisible();

    // Todo dentro del ancho de la pantalla (sin scroll interno de la tabla).
    for (const locator of [
      row.getByText('1.234,50 €'),
      row.getByText('Stock bajo'),
      row.getByRole('link', { name: /Editar/ }),
      row.getByRole('button', { name: /Eliminar/ }),
    ]) {
      await expect(locator).toBeInViewport({ ratio: 1 });
    }

    // Se mantiene la semántica de tabla para lectores de pantalla.
    await expect(row.getByRole('cell', { name: sku, exact: true })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Precio' })).toBeAttached();
  });

  test('los botones, enlaces y campos tienen al menos 44 px de alto para tocarlos con el dedo', async ({ page }) => {
    for (const url of ['/products', `/products/${product.id}/edit`]) {
      await page.goto(url);
      await expect(page.locator('.button').first()).toBeVisible();
      if (url === '/products') {
        await page.getByRole('searchbox', { name: 'Buscar' }).fill(sku);
        await expect(page.getByRole('row', { name: new RegExp(sku) })).toBeVisible();
      }

      const small = await page
        .locator('.brand, .button, input:not([type="checkbox"]), select, textarea, label.checkbox')
        .evaluateAll((elements) =>
          elements
            .filter((el) => el.getBoundingClientRect().height < 44)
            .map((el) => `${el.tagName}.${el.className} (${Math.round(el.getBoundingClientRect().height)} px)`),
        );
      expect(small, `en ${url}`).toEqual([]);
    }
  });

  test('los filtros dejan ver el primer producto en la primera pantalla', async ({ page }) => {
    await page.goto('/products');
    await page.getByRole('searchbox', { name: 'Buscar' }).fill(sku);

    await expect(page.getByRole('cell', { name: sku, exact: true })).toBeInViewport({ ratio: 1 });
    // Los filtros se compactan (búsqueda arriba, categoría y orden en dos columnas).
    const filters = await page.getByRole('search').boundingBox();
    expect(filters?.height).toBeLessThanOrEqual(220);
  });
});

test.describe('paginación en móvil', () => {
  const prefix = uniqueSku('PAGER');
  const products: TestProduct[] = [];

  test.beforeAll(async ({ request }) => {
    // 11 productos propios: con 10 por página hay dos páginas al buscar por el prefijo.
    for (let i = 0; i < 11; i++) {
      products.push(await createProduct(request, `${prefix}-${i}`, { name: `${prefix} producto ${i}` }));
    }
  });

  test.afterAll(async ({ request }) => {
    await deleteProducts(request, ...products.map((p) => p.id));
  });

  test('muestra la página y el total a lo ancho, sin partirlos entre los botones', async ({ page }) => {
    await page.goto('/products');
    await page.getByRole('searchbox', { name: 'Buscar' }).fill(prefix);
    const pager = page.getByRole('navigation', { name: 'Paginación' });
    await expect(pager).toContainText('Página 1 de 2');
    await expect(pager).toContainText('11 productos');

    const nav = await pager.boundingBox();
    const info = await pager.locator('.page-info').boundingBox();
    // El texto ocupa su propia fila (todo el ancho) y como mucho dos líneas: "Página 1 de 2" y el total.
    expect(info!.width).toBeGreaterThanOrEqual(nav!.width * 0.9);
    expect(info!.height).toBeLessThanOrEqual(56);
    await pager.scrollIntoViewIfNeeded();
    await expect(pager.getByRole('button', { name: 'Siguiente' })).toBeInViewport();
  });
});
