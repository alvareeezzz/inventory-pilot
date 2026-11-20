import { CurrencyPipe, I18nPluralPipe, Location } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, finalize, map } from 'rxjs';
import { describeHttpError } from '../../../core/http/problem-details';
import { Product, ProductFilters, ProductSort } from '../data/product.models';
import { ProductsApi } from '../data/products-api';

export const PRODUCT_LIST_PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;

@Component({
  selector: 'app-product-list',
  imports: [RouterLink, CurrencyPipe, I18nPluralPipe],
  templateUrl: './product-list.html',
  styleUrl: './product-list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductList {
  private readonly api = inject(ProductsApi);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly productCountLabels = { '=1': '# producto', other: '# productos' };

  protected readonly sortOptions: { value: ProductSort; label: string }[] = [
    { value: 'name', label: 'Nombre (A-Z)' },
    { value: '-name', label: 'Nombre (Z-A)' },
    { value: 'sku', label: 'SKU' },
    { value: 'price', label: 'Precio (menor primero)' },
    { value: '-price', label: 'Precio (mayor primero)' },
    { value: 'stock', label: 'Stock (menor primero)' },
    { value: '-stock', label: 'Stock (mayor primero)' },
  ];

  protected readonly searchInput = signal('');
  protected readonly categoryId = signal<number | null>(null);
  protected readonly lowStock = signal(false);
  protected readonly sort = signal<ProductSort>('name');
  protected readonly page = signal(1);

  // La búsqueda espera a que el usuario deje de escribir para no lanzar una petición por tecla.
  private readonly search = toSignal(
    toObservable(this.searchInput).pipe(
      debounceTime(SEARCH_DEBOUNCE_MS),
      map((value) => value.trim()),
      distinctUntilChanged(),
    ),
    { initialValue: '' },
  );

  private readonly filters = computed<ProductFilters>(() => ({
    page: this.page(),
    pageSize: PRODUCT_LIST_PAGE_SIZE,
    search: this.search(),
    categoryId: this.categoryId(),
    lowStock: this.lowStock(),
    sort: this.sort(),
  }));

  protected readonly products = this.api.productsResource(this.filters);
  protected readonly categories = this.api.categoriesResource();

  protected readonly totalPages = computed(() =>
    this.products.hasValue() ? this.products.value().totalPages : 0,
  );

  protected readonly loadError = computed(() => {
    const error = this.products.error();
    return error ? describeHttpError(error.cause ?? error) : null;
  });

  protected readonly statusMessage = signal('');
  protected readonly actionError = signal('');
  protected readonly deletingId = signal<number | null>(null);

  constructor() {
    const message: string = inject(Router).currentNavigation()?.extras.state?.['message'] ?? '';
    if (message) {
      const location = inject(Location);
      afterNextRender(() => {
        // Se muestra después del primer render: así la región role="status" ya existe y el lector de
        // pantalla anuncia el cambio (un contenido que aparece junto con la región no se anuncia).
        this.statusMessage.set(message);
        // El aviso llega en history.state y Angular lo restaura al recargar: se quita del historial.
        const state = { ...((location.getState() ?? {}) as Record<string, unknown>) };
        delete state['message'];
        location.replaceState(location.path(), '', state);
      });
    }
  }


  protected onSearchInput(value: string): void {
    this.searchInput.set(value);
    this.page.set(1);
  }

  protected onCategoryChange(value: string): void {
    this.categoryId.set(value ? Number(value) : null);
    this.page.set(1);
  }

  protected onLowStockChange(checked: boolean): void {
    this.lowStock.set(checked);
    this.page.set(1);
  }

  protected onSortChange(value: string): void {
    this.sort.set(value as ProductSort);
    this.page.set(1);
  }

  protected goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.page.set(page);
    }
  }

  protected deleteProduct(product: Product): void {
    if (!confirm(`¿Eliminar "${product.name}" (${product.sku})? Esta acción no se puede deshacer.`)) {
      return;
    }

    this.deletingId.set(product.id);
    this.actionError.set('');
    this.statusMessage.set('');

    this.api
      .delete(product.id)
      .pipe(
        finalize(() => this.deletingId.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.statusMessage.set(`Producto ${product.sku} eliminado.`);
          const wasLastItemOfPage = this.products.hasValue() && this.products.value().items.length === 1;
          if (wasLastItemOfPage && this.page() > 1) {
            this.page.update((page) => page - 1);
          } else {
            this.products.reload();
          }
        },
        error: (error: unknown) => {
          this.actionError.set(describeHttpError(error));
          // Si ya no existía (lo borró otra persona), se recarga para quitar la fila que sobra.
          if (error instanceof HttpErrorResponse && error.status === 404) {
            this.products.reload();
          }
        },
      });
  }
}
