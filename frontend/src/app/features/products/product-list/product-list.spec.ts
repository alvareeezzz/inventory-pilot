import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { Location } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideSpanishLocale } from '../../../core/locale/provide-spanish-locale';
import { buildPage, buildProduct, categories } from '../testing/product-fixtures';
import { ProductList } from './product-list';

describe('ProductList', () => {
  let fixture: ComponentFixture<ProductList>;
  let httpMock: HttpTestingController;
  let element: HTMLElement;

  const lowStockProduct = buildProduct({ id: 2, sku: 'ELEC-0002', name: 'Keyboard', stock: 4, minStock: 5, isLowStock: true });

  const isProductsRequest = (req: { url: string }) => req.url === '/api/products';

  function expectProductsRequest(): TestRequest {
    TestBed.tick();
    return httpMock.expectOne(isProductsRequest);
  }

  async function render(): Promise<void> {
    TestBed.tick();
    await fixture.whenStable();
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [ProductList],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), provideSpanishLocale()],
    });
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ProductList);
    element = fixture.nativeElement;

    TestBed.tick();
    httpMock.expectOne('/api/categories').flush(categories);
    expectProductsRequest().flush(buildPage([buildProduct(), lowStockProduct]));
    await render();
  });

  afterEach(() => {
    httpMock.verify();
    vi.restoreAllMocks();
  });

  it('muestra los productos y marca los de stock bajo', () => {
    const rows = element.querySelectorAll('tbody tr');

    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('Wireless mouse');
    expect(rows[0].classList).not.toContain('low-stock');
    expect(rows[1].classList).toContain('low-stock');
    expect(rows[1].querySelector('.badge')?.textContent).toContain('Stock bajo');
    expect(element.querySelector('.pagination')?.textContent).toContain('Página 1 de 1 · 2 productos');
  });

  describe('paginación', () => {
    const pageButton = (label: string) =>
      Array.from(element.querySelectorAll<HTMLButtonElement>('.pagination button')).find((b) =>
        b.textContent?.includes(label),
      )!;

    async function showTwoPages(): Promise<void> {
      // Recarga con un resultado de 2 páginas (cambiando el orden para lanzar una petición nueva).
      const select = element.querySelectorAll('select')[1] as HTMLSelectElement;
      select.value = 'sku';
      select.dispatchEvent(new Event('change'));
      expectProductsRequest().flush(buildPage([buildProduct()], { totalCount: 11, totalPages: 2 }));
      await render();
    }

    it('mantiene visible la página actual mientras carga la siguiente', async () => {
      await showTwoPages();

      pageButton('Siguiente').click();
      const pending = expectProductsRequest();
      // Sin whenStable: la petición sigue pendiente a propósito.
      TestBed.tick();

      expect(pending.request.params.get('page')).toBe('2');
      expect(element.querySelectorAll('tbody tr').length).toBe(1);
      expect(element.querySelector('.loading')).toBeNull();
      expect(element.querySelector('.table-wrapper')?.getAttribute('aria-busy')).toBe('true');

      pending.flush(buildPage([lowStockProduct], { page: 2, totalCount: 11, totalPages: 2 }));
      await render();
      expect(element.querySelector('tbody tr')?.textContent).toContain('Keyboard');
      expect(element.querySelector('.table-wrapper')?.getAttribute('aria-busy')).toBe('false');
    });

    it('al buscar desde la página 2 hace una sola petición, a la página 1 y ya filtrada', async () => {
      await showTwoPages();
      pageButton('Siguiente').click();
      expectProductsRequest().flush(buildPage([lowStockProduct], { page: 2, totalCount: 11, totalPages: 2 }));
      await render();

      const search = element.querySelector('input[type="search"]') as HTMLInputElement;
      search.value = 'mouse';
      search.dispatchEvent(new Event('input'));
      TestBed.tick();
      // Antes de que termine la espera de la búsqueda no debe salir ninguna petición.
      httpMock.expectNone(isProductsRequest);

      await new Promise((resolve) => setTimeout(resolve, 350));
      const req = expectProductsRequest();
      expect(req.request.params.get('page')).toBe('1');
      expect(req.request.params.get('search')).toBe('mouse');
      req.flush(buildPage([buildProduct()]));
      await render();
    });

    it('deshabilita Anterior en la primera página y Siguiente en la última', async () => {
      await showTwoPages();
      expect(pageButton('Anterior').disabled).toBe(true);
      expect(pageButton('Siguiente').disabled).toBe(false);

      pageButton('Siguiente').click();
      expectProductsRequest().flush(buildPage([lowStockProduct], { page: 2, totalCount: 11, totalPages: 2 }));
      await render();

      expect(pageButton('Anterior').disabled).toBe(false);
      expect(pageButton('Siguiente').disabled).toBe(true);
    });

    it('al borrar el único producto de la página 2 vuelve a la página 1', async () => {
      await showTwoPages();
      pageButton('Siguiente').click();
      expectProductsRequest().flush(buildPage([lowStockProduct], { page: 2, totalCount: 11, totalPages: 2 }));
      await render();
      vi.spyOn(window, 'confirm').mockReturnValue(true);

      (element.querySelector('button.danger') as HTMLButtonElement).click();
      httpMock.expectOne('/api/products/2').flush(null, { status: 204, statusText: 'No Content' });

      const next = expectProductsRequest();
      expect(next.request.params.get('page')).toBe('1');
      next.flush(buildPage([buildProduct()], { totalCount: 10, totalPages: 1 }));
      await render();
    });
  });

  it('limita la búsqueda a la misma longitud que acepta la API', () => {
    expect(element.querySelector('input[type="search"]')?.getAttribute('maxlength')).toBe('100');
  });

  it('tras un error no vuelve a mostrar datos antiguos al cambiar de filtro', async () => {
    const select = element.querySelectorAll('select')[0] as HTMLSelectElement;
    select.value = '2';
    select.dispatchEvent(new Event('change'));
    expectProductsRequest().flush({ title: 'Error' }, { status: 500, statusText: 'Server Error' });
    await render();
    expect(element.querySelector('.alert.error')).not.toBeNull();

    const checkbox = element.querySelector('input[type="checkbox"]') as HTMLInputElement;
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));
    const pending = expectProductsRequest();
    TestBed.tick();

    // Mientras carga: "Cargando…", no la tabla del último resultado correcto (de otros filtros).
    expect(element.querySelectorAll('tbody tr').length).toBe(0);
    expect(element.querySelector('.loading')).not.toBeNull();
    pending.flush(buildPage([lowStockProduct]));
    await render();
    expect(element.querySelectorAll('tbody tr').length).toBe(1);
  });

  it('marca como ocupado el mensaje de lista vacía mientras carga otro filtro', async () => {
    const checkbox = element.querySelector('input[type="checkbox"]') as HTMLInputElement;
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));
    expectProductsRequest().flush(buildPage([]));
    await render();
    expect(element.querySelector('.empty')?.getAttribute('aria-busy')).toBe('false');

    checkbox.checked = false;
    checkbox.dispatchEvent(new Event('change'));
    const pending = expectProductsRequest();
    TestBed.tick();

    expect(element.querySelector('.empty')?.getAttribute('aria-busy')).toBe('true');
    pending.flush(buildPage([buildProduct()]));
    await render();
  });

  it('usa el singular cuando solo hay un producto', async () => {
    const checkbox = element.querySelector('input[type="checkbox"]') as HTMLInputElement;
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));
    expectProductsRequest().flush(buildPage([lowStockProduct]));
    await render();

    const pagination = element.querySelector('.pagination')?.textContent ?? '';
    expect(pagination).toContain('· 1 producto');
    expect(pagination).not.toContain('productos');
  });

  it('formatea el precio en euros con formato español', () => {
    expect(element.querySelector('tbody tr td.numeric')?.textContent?.replace(/\s/g, ' ')).toContain('19,99 €');
  });

  it('recarga filtrando por categoría y vuelve a la primera página', async () => {
    const select = element.querySelectorAll('select')[0] as HTMLSelectElement;
    select.value = '2';
    select.dispatchEvent(new Event('change'));

    const req = expectProductsRequest();
    expect(req.request.params.get('categoryId')).toBe('2');
    expect(req.request.params.get('page')).toBe('1');
    req.flush(buildPage([]));
    await render();

    expect(element.querySelector('.empty')?.textContent).toContain('No hay productos');
  });

  it('filtra por stock bajo', () => {
    const checkbox = element.querySelector('input[type="checkbox"]') as HTMLInputElement;
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));

    const req = expectProductsRequest();
    expect(req.request.params.get('lowStock')).toBe('true');
    req.flush(buildPage([lowStockProduct]));
  });

  it('busca tras dejar de escribir, sin una petición por tecla', async () => {
    const input = element.querySelector('input[type="search"]') as HTMLInputElement;
    for (const value of ['m', 'mo', 'mouse']) {
      input.value = value;
      input.dispatchEvent(new Event('input'));
      TestBed.tick();
    }
    httpMock.expectNone(isProductsRequest);

    // Espera real algo mayor que el debounce (300 ms).
    await new Promise((resolve) => setTimeout(resolve, 350));
    const req = expectProductsRequest();
    expect(req.request.params.get('search')).toBe('mouse');
    req.flush(buildPage([buildProduct()]));
  });

  it('elimina un producto tras confirmar y recarga el listado', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    (element.querySelectorAll('button.danger')[1] as HTMLButtonElement).click();
    const deleteReq = httpMock.expectOne('/api/products/2');
    expect(deleteReq.request.method).toBe('DELETE');
    deleteReq.flush(null, { status: 204, statusText: 'No Content' });

    expectProductsRequest().flush(buildPage([buildProduct()]));
    await render();

    expect(element.querySelector('.alert.success')?.textContent).toContain('Producto ELEC-0002 eliminado.');
    expect(element.querySelectorAll('tbody tr').length).toBe(1);
  });

  it('no elimina nada si el usuario cancela la confirmación', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    (element.querySelector('button.danger') as HTMLButtonElement).click();

    httpMock.expectNone('/api/products/1');
  });

  it('si el producto ya no existía (404) muestra el aviso y recarga la lista para quitar la fila', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    (element.querySelector('button.danger') as HTMLButtonElement).click();
    httpMock
      .expectOne('/api/products/1')
      .flush(
        { title: 'Producto no encontrado', detail: 'No existe ningún producto con el id 1.' },
        { status: 404, statusText: 'Not Found' },
      );
    expectProductsRequest().flush(buildPage([lowStockProduct]));
    await render();

    expect(element.querySelector('.alert.error')?.textContent).toContain('No existe ningún producto con el id 1.');
    expect(element.querySelectorAll('tbody tr').length).toBe(1);
  });

  it('muestra el error si falla el borrado', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    (element.querySelector('button.danger') as HTMLButtonElement).click();
    httpMock
      .expectOne('/api/products/1')
      .flush({ title: 'Error', detail: 'No se pudo eliminar.' }, { status: 500, statusText: 'Server Error' });
    await render();

    expect(element.querySelector('.alert.error')?.textContent).toContain('No se pudo eliminar.');
  });
});

describe('ProductList · aviso tras guardar', () => {
  it('muestra el aviso recibido en la navegación y lo quita del historial para que no reaparezca al recargar', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'products', component: ProductList }]),
        provideSpanishLocale(),
      ],
    });
    const httpMock = TestBed.inject(HttpTestingController);
    const harness = await RouterTestingHarness.create();

    await TestBed.inject(Router).navigateByUrl('/products', { state: { message: 'Producto TEST-1 creado.' } });
    TestBed.tick();
    httpMock.expectOne('/api/categories').flush(categories);
    httpMock.expectOne((req) => req.url === '/api/products').flush(buildPage([buildProduct()]));
    harness.detectChanges();
    await harness.fixture.whenStable();

    // Dentro de una región role="status" para que el lector de pantalla lo anuncie.
    expect(harness.routeNativeElement?.querySelector('[role="status"] .alert.success')?.textContent).toContain(
      'Producto TEST-1 creado.',
    );
    // Al recargar, Angular restaura history.state: el mensaje no debe seguir ahí.
    const state = TestBed.inject(Location).getState() as Record<string, unknown> | null;
    expect(state?.['message']).toBeUndefined();
    httpMock.verify();
  });
});

describe('ProductList · datos especiales', () => {
  function setup(): { fixture: ComponentFixture<ProductList>; httpMock: HttpTestingController } {
    TestBed.configureTestingModule({
      imports: [ProductList],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), provideSpanishLocale()],
    });
    const fixture = TestBed.createComponent(ProductList);
    TestBed.tick();
    return { fixture, httpMock: TestBed.inject(HttpTestingController) };
  }

  it('si fallan las categorías muestra los productos y un aviso, sin bloquear la página', async () => {
    const { fixture, httpMock } = setup();
    httpMock.expectOne('/api/categories').flush(null, { status: 500, statusText: 'Server Error' });
    httpMock.expectOne((req) => req.url === '/api/products').flush(buildPage([buildProduct()]));
    TestBed.tick();
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;

    expect(element.querySelectorAll('tbody tr').length).toBe(1);
    expect(element.querySelector('.loading')).toBeNull();
    expect(element.textContent).toContain('No se han podido cargar las categorías.');
    // Solo queda la opción "Todas" en el filtro.
    expect(element.querySelectorAll('select')[0].options.length).toBe(1);
  });

  it('muestra el stock con separador de miles, como el precio', async () => {
    const { fixture, httpMock } = setup();
    httpMock.expectOne('/api/categories').flush(categories);
    httpMock.expectOne((req) => req.url === '/api/products').flush(buildPage([buildProduct({ stock: 1_000_000 })]));
    TestBed.tick();
    await fixture.whenStable();

    const stockCell = (fixture.nativeElement as HTMLElement).querySelector('td[data-label="Stock"]');
    expect(stockCell?.textContent).toContain('1.000.000');
  });
});
