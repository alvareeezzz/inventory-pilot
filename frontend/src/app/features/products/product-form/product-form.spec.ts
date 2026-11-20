import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideSpanishLocale } from '../../../core/locale/provide-spanish-locale';
import { buildProduct, categories } from '../testing/product-fixtures';
import { ProductForm } from './product-form';

describe('ProductForm', () => {
  let fixture: ComponentFixture<ProductForm>;
  let httpMock: HttpTestingController;
  let element: HTMLElement;
  let navigate: ReturnType<typeof vi.spyOn>;

  async function create(id?: string): Promise<void> {
    fixture = TestBed.createComponent(ProductForm);
    element = fixture.nativeElement;
    if (id !== undefined) {
      fixture.componentRef.setInput('id', id);
    }
    fixture.detectChanges();
    TestBed.tick();
    httpMock.expectOne('/api/categories').flush(categories);
    await render();
  }

  async function render(): Promise<void> {
    TestBed.tick();
    await fixture.whenStable();
  }

  function type(selector: string, value: string): void {
    const input = element.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  function selectCategory(index: number): void {
    const select = element.querySelector('select') as HTMLSelectElement;
    select.selectedIndex = index;
    select.dispatchEvent(new Event('change'));
  }

  function fillValidForm(): void {
    type('[formControlName="sku"]', ' elec-0100 ');
    type('[formControlName="name"]', '  Webcam HD ');
    type('[formControlName="price"]', '49.9');
    type('[formControlName="stock"]', '12');
    type('[formControlName="minStock"]', '3');
    selectCategory(1);
  }

  function submit(): void {
    (element.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ProductForm],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), provideSpanishLocale()],
    });
    httpMock = TestBed.inject(HttpTestingController);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });

  afterEach(() => httpMock.verify());

  it('no envía nada y muestra los errores si el formulario es inválido', async () => {
    await create();

    submit();
    await render();

    httpMock.expectNone('/api/products');
    expect(element.querySelector('#sku-error')?.textContent).toContain('Este campo es obligatorio.');
    expect(element.querySelector('#category-error')?.textContent).toContain('Selecciona una categoría.');
    expect(element.querySelector('#price-error')?.textContent).toContain('El valor mínimo es 0,01.');
  });

  it('al enviar con errores lleva el foco al primer campo inválido', async () => {
    await create();
    type('[formControlName="sku"]', 'ELEC-0100');
    type('[formControlName="name"]', 'Webcam');

    submit();
    await render();

    // SKU y nombre son válidos: el primero con error es la categoría.
    expect(document.activeElement).toBe(element.querySelector('[formControlName="categoryId"]'));
  });

  it('valida el formato del SKU y que el stock sea entero', async () => {
    await create();

    type('[formControlName="sku"]', 'bad sku!');
    type('[formControlName="stock"]', '1.5');
    await render();

    expect(element.querySelector('#sku-error')?.textContent).toContain('Solo letras, números y guiones.');
    expect(element.querySelector('#stock-error')?.textContent).toContain('Debe ser un número entero.');
  });

  it('crea el producto con los datos normalizados y vuelve al listado', async () => {
    await create();
    fillValidForm();

    submit();
    const req = httpMock.expectOne('/api/products');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      sku: 'ELEC-0100',
      name: 'Webcam HD',
      description: null,
      categoryId: 1,
      price: 49.9,
      stock: 12,
      minStock: 3,
    });
    req.flush(buildProduct({ id: 100, sku: 'ELEC-0100' }));
    await render();

    expect(navigate).toHaveBeenCalledWith(['/products'], { state: { message: 'Producto ELEC-0100 creado.' } });
  });

  it('marca el SKU como duplicado si la API responde 409', async () => {
    await create();
    fillValidForm();

    submit();
    httpMock.expectOne('/api/products').flush({ title: 'SKU duplicado' }, { status: 409, statusText: 'Conflict' });
    await render();

    expect(element.querySelector('#sku-error')?.textContent).toContain('Ya existe un producto con este SKU.');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('muestra junto a cada campo los errores de validación de la API', async () => {
    await create();
    fillValidForm();

    submit();
    httpMock
      .expectOne('/api/products')
      .flush(
        { title: 'Validation', errors: { CategoryId: ['La categoría 1 no existe.'] } },
        { status: 400, statusText: 'Bad Request' },
      );
    await render();

    expect(element.querySelector('#category-error')?.textContent).toContain('La categoría 1 no existe.');
  });

  it('en edición carga el producto y guarda con PUT', async () => {
    await create('2');
    httpMock.expectOne('/api/products/2').flush(buildProduct({ id: 2, sku: 'ELEC-0002', name: 'Keyboard', categoryId: 2 }));
    await render();

    expect(element.querySelector('h1')?.textContent).toContain('Editar producto');
    expect((element.querySelector('[formControlName="name"]') as HTMLInputElement).value).toBe('Keyboard');
    expect((element.querySelector('select') as HTMLSelectElement).selectedIndex).toBe(2);

    type('[formControlName="name"]', 'Keyboard ES');
    submit();
    const req = httpMock.expectOne('/api/products/2');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.name).toBe('Keyboard ES');
    req.flush(buildProduct({ id: 2, sku: 'ELEC-0002' }));
    await render();

    expect(navigate).toHaveBeenCalledWith(['/products'], { state: { message: 'Producto ELEC-0002 guardado.' } });
  });

  it('avisa si el producto a editar no existe', async () => {
    await create('999');
    httpMock.expectOne('/api/products/999').flush(null, { status: 404, statusText: 'Not Found' });
    await render();

    expect(element.querySelector('.alert.error')?.textContent).toContain('El producto no existe');
    // Sin producto que editar no debe ofrecerse un formulario vacío para "guardar".
    expect(element.querySelector('form')).toBeNull();
    expect(element.querySelector('a[routerLink="/products"]')?.textContent).toContain('Volver al listado');
  });

  it.each(['abc', '0', '-3', '2.5', '1e3'])('con un id no válido ("%s") avisa sin llamar a la API', async (id) => {
    await create(id);

    httpMock.expectNone((req) => req.url.startsWith('/api/products'));
    expect(element.querySelector('.alert.error')?.textContent).toContain('El producto no existe');
    expect(element.querySelector('form')).toBeNull();
  });

  it('muestra los límites numéricos con formato español', async () => {
    await create();

    type('[formControlName="price"]', '0');
    type('[formControlName="stock"]', '2000000');
    await render();

    expect(element.querySelector('#price-error')?.textContent).toContain('El valor mínimo es 0,01.');
    expect(element.querySelector('#stock-error')?.textContent).toContain('El valor máximo es 1.000.000.');
  });
});
