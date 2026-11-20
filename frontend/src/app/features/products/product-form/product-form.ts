import { formatNumber } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  LOCALE_ID,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidatorFn, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { describeHttpError, getProblemDetails } from '../../../core/http/problem-details';
import { PRODUCT_RULES, Product, ProductRequest } from '../data/product.models';
import { ProductsApi } from '../data/products-api';

const INTEGER = /^\d+$/;
/** Id de ruta válido: entero positivo sin signo, decimales ni notación científica. */
const PRODUCT_ID = /^[1-9]\d*$/;
const NOT_FOUND_MESSAGE = 'El producto no existe o ha sido eliminado.';

type FieldName = 'sku' | 'name' | 'description' | 'categoryId' | 'price' | 'stock' | 'minStock';

@Component({
  selector: 'app-product-form',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './product-form.html',
  styleUrl: './product-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductForm implements OnInit {
  private readonly api = inject(ProductsApi);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly locale = inject(LOCALE_ID);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Parámetro de ruta ":id" (solo en edición). */
  readonly id = input<string>();

  protected readonly isEdit = computed(() => this.id() !== undefined);
  protected readonly categoryList = this.api.categoryList;
  protected readonly categoriesFailed = this.api.categoriesFailed;
  protected readonly loading = signal(false);
  /** Edición sin producto cargado (no existe o falló la carga): no se muestra el formulario. */
  protected readonly loadFailed = signal(false);
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal('');

  protected readonly rules = PRODUCT_RULES;

  protected readonly form = inject(NonNullableFormBuilder).group({
    sku: ['', [Validators.required, Validators.maxLength(PRODUCT_RULES.skuMaxLength), Validators.pattern(PRODUCT_RULES.skuPattern)]],
    name: ['', [Validators.required, Validators.maxLength(PRODUCT_RULES.nameMaxLength)]],
    description: ['', [Validators.maxLength(PRODUCT_RULES.descriptionMaxLength)]],
    categoryId: [0, [Validators.min(1)]],
    price: [0, [Validators.required, Validators.min(PRODUCT_RULES.minPrice), Validators.max(PRODUCT_RULES.maxAmount)]],
    stock: quantity(),
    minStock: quantity(),
  });

  ngOnInit(): void {
    // Carga las categorías compartidas (o las reintenta si la carga anterior falló).
    this.api.loadCategories();

    const id = this.id();
    if (id === undefined) {
      return;
    }

    // Un id no numérico (/products/abc/edit) no puede existir: se avisa sin llamar a la API.
    if (!PRODUCT_ID.test(id)) {
      this.loadFailed.set(true);
      this.errorMessage.set(NOT_FOUND_MESSAGE);
      return;
    }

    this.loading.set(true);
    this.api
      .getProduct(Number(id))
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (product) => this.fillForm(product),
        error: (error: unknown) => {
          this.loadFailed.set(true);
          this.errorMessage.set(
            error instanceof HttpErrorResponse && error.status === 404
              ? NOT_FOUND_MESSAGE
              : describeHttpError(error),
          );
        },
      });
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.focusFirstInvalidField();
      return;
    }

    const request = this.toRequest();
    const id = this.id();
    const save$ = id === undefined ? this.api.create(request) : this.api.update(Number(id), request);

    this.saving.set(true);
    this.errorMessage.set('');

    save$
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (product) =>
          this.router.navigate(['/products'], {
            state: { message: `Producto ${product.sku} ${id === undefined ? 'creado' : 'guardado'}.` },
          }),
        error: (error: unknown) => this.handleSaveError(error),
      });
  }

  /** Primer mensaje de error del campo, solo cuando el usuario ya ha interactuado con él. */
  protected fieldError(name: FieldName): string | null {
    const control = this.form.controls[name];
    if (!control.invalid || !(control.touched || control.dirty)) {
      return null;
    }
    if (name === 'categoryId' && control.hasError('min')) {
      return 'Selecciona una categoría.';
    }
    return describeControlError(control, this.locale);
  }

  private fillForm(product: Product): void {
    this.form.setValue({
      sku: product.sku,
      name: product.name,
      description: product.description ?? '',
      categoryId: product.categoryId,
      price: product.price,
      stock: product.stock,
      minStock: product.minStock,
    });
  }

  private toRequest(): ProductRequest {
    const value = this.form.getRawValue();
    const description = value.description.trim();
    return {
      sku: value.sku.trim().toUpperCase(),
      name: value.name.trim(),
      description: description || null,
      categoryId: value.categoryId,
      price: value.price,
      stock: value.stock,
      minStock: value.minStock,
    };
  }

  private handleSaveError(error: unknown): void {
    const problem = getProblemDetails(error);
    const status = error instanceof HttpErrorResponse ? error.status : 0;

    if (status === 409) {
      this.form.controls.sku.setErrors({ duplicate: true });
      this.form.controls.sku.markAsTouched();
      this.focusFirstInvalidField();
      return;
    }

    if (status === 400 && problem?.errors) {
      // La API devuelve los errores por campo: se muestran junto a cada control.
      let mapped = false;
      for (const [field, messages] of Object.entries(problem.errors)) {
        const control = this.findControl(field);
        if (control) {
          control.setErrors({ server: messages[0] });
          control.markAsTouched();
          mapped = true;
        }
      }
      if (mapped) {
        this.focusFirstInvalidField();
        return;
      }
    }

    this.errorMessage.set(describeHttpError(error));
  }

  /** Lleva el foco al primer campo con error, en el orden en que aparecen en pantalla. */
  private focusFirstInvalidField(): void {
    const fields = this.host.nativeElement.querySelectorAll<HTMLElement>('[formControlName]');
    const firstInvalid = Array.from(fields).find(
      (field) => this.form.get(field.getAttribute('formControlName') ?? '')?.invalid,
    );
    firstInvalid?.focus();
  }

  private findControl(field: string): AbstractControl | null {
    const name = Object.keys(this.form.controls).find((key) => key.toLowerCase() === field.toLowerCase());
    return name ? this.form.get(name) : null;
  }
}

/** Stock y stock mínimo: enteros entre 0 y el máximo. */
function quantity(): [number, ValidatorFn[]] {
  return [0, [Validators.required, Validators.min(0), Validators.max(PRODUCT_RULES.maxAmount), Validators.pattern(INTEGER)]];
}

function describeControlError(control: AbstractControl, locale: string): string {
  const errors = control.errors ?? {};
  // Los límites se muestran con el formato numérico del idioma (0,01 · 1.000.000).
  const format = (value: number) => formatNumber(value, locale, '1.0-2');
  if (errors['server']) return errors['server'];
  if (errors['duplicate']) return 'Ya existe un producto con este SKU.';
  if (errors['required']) return 'Este campo es obligatorio.';
  if (errors['maxlength']) return `Máximo ${errors['maxlength'].requiredLength} caracteres.`;
  if (errors['min']) return `El valor mínimo es ${format(errors['min'].min)}.`;
  if (errors['max']) return `El valor máximo es ${format(errors['max'].max)}.`;
  if (errors['pattern']) {
    return errors['pattern'].requiredPattern === String(INTEGER)
      ? 'Debe ser un número entero.'
      : 'Solo letras, números y guiones.';
  }
  return 'Valor no válido.';
}
