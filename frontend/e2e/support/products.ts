import { APIRequestContext, expect } from '@playwright/test';

/** Datos de un producto creado por un test e2e. */
export interface TestProduct {
  id: number;
  sku: string;
  name: string;
}

export interface NewProduct {
  name: string;
  categoryId?: number;
  price?: number;
  stock?: number;
  minStock?: number;
}

/** SKU único por ejecución para que los tests no choquen entre sí ni con los datos de ejemplo. */
export function uniqueSku(prefix: string): string {
  return `E2E-${prefix}-${Date.now().toString(36)}`.toUpperCase();
}

/** Crea un producto directamente por la API (preparación del test). */
export async function createProduct(request: APIRequestContext, sku: string, product: NewProduct): Promise<TestProduct> {
  const response = await request.post('/api/products', {
    data: {
      sku,
      name: product.name,
      description: 'Creado por un test e2e',
      categoryId: product.categoryId ?? 1,
      price: product.price ?? 10,
      stock: product.stock ?? 20,
      minStock: product.minStock ?? 5,
    },
  });
  expect(response.status(), await response.text()).toBe(201);
  return response.json();
}

/** Borra los productos creados por el test; ignora los que ya no existan. */
export async function deleteProducts(request: APIRequestContext, ...ids: number[]): Promise<void> {
  for (const id of ids) {
    const response = await request.delete(`/api/products/${id}`);
    expect([204, 404]).toContain(response.status());
  }
}
