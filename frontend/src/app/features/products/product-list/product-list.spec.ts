import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
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
