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
