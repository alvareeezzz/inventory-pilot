/** Modelos que reflejan los DTOs de la API (Inventory.Api.Features). */

export interface Category {
  id: number;
  name: string;
}

export interface Product {
  id: number;
  sku: string;
  name: string;
  description: string | null;
  categoryId: number;
  categoryName: string;
  price: number;
  stock: number;
  minStock: number;
  isLowStock: boolean;
  createdAt: string;
  updatedAt: string | null;
}

/**
 * Límites de un producto: los mismos que valida la API (constantes de Product en el backend).
 * El e2e validation-limits comprueba que coinciden.
 */
export const PRODUCT_RULES = {
  skuMaxLength: 32,
  nameMaxLength: 100,
  descriptionMaxLength: 500,
  /** Búsqueda del listado (ProductQuery.SearchMaxLength en la API). */
  searchMaxLength: 100,
  minPrice: 0.01,
  maxAmount: 1_000_000,
  /** Letras, números y guiones (se admiten espacios alrededor porque el SKU se recorta). */
  skuPattern: /^\s*[A-Za-z0-9-]+\s*$/,
} as const;

export interface ProductRequest {
  sku: string;
  name: string;
  description: string | null;
  categoryId: number;
  price: number;
  stock: number;
  minStock: number;
}

export interface PagedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export type ProductSort = 'name' | '-name' | 'sku' | '-sku' | 'price' | '-price' | 'stock' | '-stock';

export interface ProductFilters {
  page: number;
  pageSize: number;
  search: string;
  categoryId: number | null;
  lowStock: boolean;
  sort: ProductSort;
}
