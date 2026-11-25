import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
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

describe('ProductsApi · categorías', () => {
  it('pide las categorías una sola vez aunque las usen varias pantallas', async () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const httpMock = TestBed.inject(HttpTestingController);
    const api = TestBed.inject(ProductsApi);

    // El listado y el formulario leen el mismo recurso compartido.
    api.loadCategories();
    const fromList = api.categories;
    TestBed.tick();
    httpMock.expectOne('/api/categories').flush([{ id: 1, name: 'Electronics' }]);
    await TestBed.inject(ApplicationRef).whenStable();
    api.loadCategories();
    const fromForm = api.categories;
    TestBed.tick();

    httpMock.expectNone('/api/categories');
    expect(fromForm).toBe(fromList);
    expect(fromForm.value()).toEqual([{ id: 1, name: 'Electronics' }]);
    httpMock.verify();
  });
});

describe('ProductsApi · categorías tras un error', () => {
  it('si la carga falló, la reintenta cuando otra pantalla las vuelve a pedir', async () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const httpMock = TestBed.inject(HttpTestingController);
    const api = TestBed.inject(ProductsApi);

    api.loadCategories();
    TestBed.tick();
    httpMock.expectOne('/api/categories').flush(null, { status: 500, statusText: 'Server Error' });
    await TestBed.inject(ApplicationRef).whenStable();
    expect(api.categories.error()).toBeTruthy();

    api.loadCategories();
    TestBed.tick();
    httpMock.expectOne('/api/categories').flush([{ id: 1, name: 'Electronics' }]);
    await TestBed.inject(ApplicationRef).whenStable();
    expect(api.categories.value()).toEqual([{ id: 1, name: 'Electronics' }]);
  });
});
