import { Category, PagedResponse, Product } from '../data/product.models';

/** Datos de prueba compartidos por los tests de productos. */
export const categories: Category[] = [
  { id: 1, name: 'Electronics' },
  { id: 2, name: 'Office' },
];

export function buildProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 1,
    sku: 'ELEC-0001',
    name: 'Wireless mouse',
    description: 'Ergonomic',
    categoryId: 1,
    categoryName: 'Electronics',
    price: 19.99,
    stock: 45,
    minStock: 10,
    isLowStock: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: null,
    ...overrides,
  };
}

export function buildPage(items: Product[], overrides: Partial<PagedResponse<Product>> = {}): PagedResponse<Product> {
  return {
    items,
    page: 1,
    pageSize: 10,
    totalCount: items.length,
    totalPages: items.length === 0 ? 0 : 1,
    ...overrides,
  };
}
