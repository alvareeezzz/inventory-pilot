import { HttpClient, HttpParams, httpResource } from '@angular/common/http';
import { Injectable, Signal, computed, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../../core/http/api-base-url';
import { Category, PagedResponse, Product, ProductFilters, ProductRequest } from './product.models';

/** Acceso a los endpoints de productos y categorías. */
@Injectable({ providedIn: 'root' })
export class ProductsApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * Categorías para filtros y formularios. Casi no cambian y no hay mantenimiento de categorías en la
   * app, así que se piden una sola vez y se comparten entre pantallas (servicio raíz).
   */
  readonly categories = httpResource<Category[]>(() => `${this.baseUrl}/categories`, { defaultValue: [] });

  /**
   * Lista segura para las plantillas: leer value() de un recurso con error lanza una excepción
   * (y rompe el render), así que con error o cargando se devuelve una lista vacía.
   */
  readonly categoryList = computed(() => (this.categories.hasValue() ? this.categories.value() : []));

  readonly categoriesFailed = computed(() => this.categories.status() === 'error');

  /** Devuelve las categorías compartidas; si la última carga falló, la reintenta. */
  loadCategories() {
    if (this.categories.error()) {
      this.categories.reload();
    }
    return this.categories;
  }

  /** Listado reactivo: se recarga solo cuando cambian los filtros. Llamar en contexto de inyección. */
  productsResource(filters: Signal<ProductFilters>) {
    return httpResource<PagedResponse<Product>>(() => ({
      url: `${this.baseUrl}/products`,
      params: toQueryParams(filters()),
    }));
  }

  getProduct(id: number): Observable<Product> {
    return this.http.get<Product>(`${this.baseUrl}/products/${id}`);
  }

  create(request: ProductRequest): Observable<Product> {
    return this.http.post<Product>(`${this.baseUrl}/products`, request);
  }

  update(id: number, request: ProductRequest): Observable<Product> {
    return this.http.put<Product>(`${this.baseUrl}/products/${id}`, request);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/products/${id}`);
  }
}

/** Solo envía los filtros con valor, para que la URL quede limpia. */
export function toQueryParams(filters: ProductFilters): HttpParams {
  let params = new HttpParams().set('page', filters.page).set('pageSize', filters.pageSize);
  const search = filters.search.trim();
  if (search) {
    params = params.set('search', search);
  }
  if (filters.categoryId !== null) {
    params = params.set('categoryId', filters.categoryId);
  }
  if (filters.lowStock) {
    params = params.set('lowStock', true);
  }
  if (filters.sort !== 'name') {
    params = params.set('sort', filters.sort);
  }
  return params;
}
