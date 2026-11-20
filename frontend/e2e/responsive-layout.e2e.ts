import { expect, test } from '@playwright/test';
import { TestProduct, createProduct, deleteProducts, uniqueSku } from './support/products';

// Tamaños de tablet y escritorio (por encima del corte de las tarjetas móviles).
const WIDTHS = [800, 900, 1024, 1280];

test.describe('tabla en tablet y escritorio', () => {
  const sku = uniqueSku('WIDE');
  let product: TestProduct;

  test.beforeAll(async ({ request }) => {
    // Nombre largo (90 caracteres, el máximo es 100) para forzar el ancho de la columna.
    // Con stock bajo, para que la celda de stock lleve también el aviso.
    product = await createProduct(request, sku, {
      name: `${sku} ${'nombre muy largo '.repeat(5)}`.slice(0, 90),
      stock: 1,
      minStock: 5,
    });
  });

  test.afterAll(async ({ request }) => {
    await deleteProducts(request, product.id);
  });

  for (const width of WIDTHS) {
    test(`a ${width} px las acciones se ven sin desplazar la tabla`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/products');
      await page.getByRole('searchbox', { name: 'Buscar' }).fill(sku);
      const row = page.getByRole('row', { name: new RegExp(sku) });
      await expect(row).toBeVisible();

      await expect(row.getByRole('link', { name: /Editar/ })).toBeInViewport({ ratio: 1 });
      await expect(row.getByRole('button', { name: /Eliminar/ })).toBeInViewport({ ratio: 1 });

      // La tabla cabe en su contenedor: no hay scroll interno escondiendo columnas.
      const overflow = await page.locator('.table-wrapper').evaluate((el) => el.scrollWidth - el.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  test('las celdas de una fila ocupan toda su altura y los bordes quedan alineados', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/products');
    await page.getByRole('searchbox', { name: 'Buscar' }).fill(sku);
    const row = page.getByRole('row', { name: new RegExp(sku) });
    await expect(row).toBeVisible();

    const cells = await row.getByRole('cell').evaluateAll((elements) =>
      elements.map((el) => {
        const box = el.getBoundingClientRect();
        return { top: Math.round(box.top), bottom: Math.round(box.bottom), display: getComputedStyle(el).display };
      }),
    );
    expect(cells).toHaveLength(6);
    for (const cell of cells) {
      expect(cell.display).toBe('table-cell');
      expect(cell.top).toBe(cells[0].top);
      expect(cell.bottom).toBe(cells[0].bottom);
    }
  });
});
