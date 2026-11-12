import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'products' },
  {
    path: 'products',
    title: 'Productos · Inventario',
    loadComponent: () => import('./features/products/product-list/product-list').then((m) => m.ProductList),
  },
  {
    path: 'products/new',
    title: 'Nuevo producto · Inventario',
    loadComponent: () => import('./features/products/product-form/product-form').then((m) => m.ProductForm),
  },
  {
    path: 'products/:id/edit',
    title: 'Editar producto · Inventario',
    loadComponent: () => import('./features/products/product-form/product-form').then((m) => m.ProductForm),
  },
  { path: '**', redirectTo: 'products' },
];
