import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ProductFilters, ProductRequest } from './product.models';
import { ProductsApi, toQueryParams } from './products-api';

const defaultFilters: ProductFilters = {
  page: 1,
  pageSize: 10,
  search: '',
  categoryId: null,
  lowStock: false,
  sort: 'name',
};

const request: ProductRequest = {
  sku: 'ELEC-9',
  name: 'Test',
  description: null,
  categoryId: 1,
  price: 10,
  stock: 5,
  minStock: 1,
};

describe('toQueryParams', () => {
  it('envía solo la paginación cuando no hay filtros', () => {
    expect(toQueryParams(defaultFilters).toString()).toBe('page=1&pageSize=10');
  });

  it('incluye los filtros con valor y recorta la búsqueda', () => {
    const params = toQueryParams({
      ...defaultFilters,
      page: 2,
      search: '  mouse ',
      categoryId: 3,
      lowStock: true,
      sort: '-price',
    });

    expect(params.toString()).toBe('page=2&pageSize=10&search=mouse&categoryId=3&lowStock=true&sort=-price');
  });
});

describe('ProductsApi', () => {
  let api: ProductsApi;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(ProductsApi);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('crea un producto con POST', () => {
    api.create(request).subscribe();

    const req = httpMock.expectOne('/api/products');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(request);
    req.flush({});
  });

  it('actualiza un producto con PUT a su id', () => {
    api.update(7, request).subscribe();

    const req = httpMock.expectOne('/api/products/7');
    expect(req.request.method).toBe('PUT');
    req.flush({});
  });

  it('elimina un producto con DELETE a su id', () => {
    api.delete(7).subscribe();

    const req = httpMock.expectOne('/api/products/7');
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
  });
});
