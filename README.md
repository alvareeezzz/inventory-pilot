# Inventory Pilot

Aplicación piloto de gestión de inventario: listado de productos con búsqueda, filtros (categoría y stock bajo), ordenación y paginación, más alta, edición y borrado.

| Parte | Tecnología |
|---|---|
| API | .NET 10 · Minimal API · EF Core 10 |
| Frontend | Angular 22 (standalone, zoneless, signals) |
| Base de datos | SQL Server LocalDB |
| Tests | xUnit + `WebApplicationFactory` (API) · Vitest (Angular) |

## Requisitos

- .NET SDK 10
- Node.js 22.22.3 o superior (lo exige Angular 22)
- SQL Server LocalDB (incluido con Visual Studio) y la herramienta `dotnet-ef`:
  ```bash
  dotnet tool install -g dotnet-ef
  ```

## Puesta en marcha

1. **Base de datos.** Crea `InventoryPilot` en `(localdb)\MSSQLLocalDB` con datos de ejemplo:
   ```bash
   cd backend
   dotnet ef database update --project src/Inventory.Api
   ```
2. **API** (https://localhost:7080):
   ```bash
   cd backend
   dotnet run --project src/Inventory.Api --launch-profile https
   ```
3. **Frontend** (http://localhost:4200):
   ```bash
   cd frontend
   npm install
   npm start
   ```
   El servidor de Angular redirige `/api` a la API mediante `frontend/proxy.conf.json`, así que no hace falta confiar en el certificado HTTPS de desarrollo. La URL de la API se configura en `frontend/src/environments/` (`apiUrl`).

## Tests

```bash
cd backend && dotnet test     # crea y borra una base de datos LocalDB temporal por clase de test
cd frontend && npx ng test --watch=false
cd frontend && npx ng lint
```

### Tests e2e (Playwright)

```bash
cd frontend && npm run e2e
```

- Usan el **Google Chrome instalado** (`channel: 'chrome'`), así que no hace falta descargar navegadores.
- Arrancan solos la API y el frontend si no están en marcha (o reutilizan los que ya lo estén).
- Trabajan contra la base de datos de desarrollo (`InventoryPilot`): cada test crea sus propios productos con SKU `E2E-...` y los borra al terminar.
- Si un test falla, el informe con trazas y capturas queda en `frontend/playwright-report` (`npx playwright show-report`).

| Archivo | Qué comprueba |
|---|---|
| `e2e/product-lifecycle.e2e.ts` | Crear, editar (stock bajo → normal) y eliminar un producto |
| `e2e/product-filters.e2e.ts` | Búsqueda, filtro por categoría y por stock bajo |
| `e2e/product-form-errors.e2e.ts` | Validaciones, SKU duplicado y edición de un producto inexistente |
| `e2e/mobile-layout.e2e.ts` | En móvil (375 px): sin scroll horizontal, cada producto como tarjeta con precio, stock y acciones visibles, filtros compactos y objetivos táctiles de 44 px |
| `e2e/responsive-layout.e2e.ts` | De 800 a 1280 px, con un nombre largo, la tabla cabe sin scroll interno y las acciones se ven |
| `e2e/status-message.e2e.ts` | El aviso de producto creado no reaparece al recargar la página |
| `e2e/delete-missing-product.e2e.ts` | Eliminar un producto que ya no existe muestra el aviso y lo quita del listado |
| `e2e/validation-limits.e2e.ts` | La API y el formulario aplican los mismos límites (longitudes de texto e importe máximo) |

## Estructura

```
backend/
  src/Inventory.Api/
    Features/Products/     endpoints, contratos (DTOs y validación) y filtros/orden
    Features/Categories/
    Data/                  DbContext, configuración Fluent API, datos de ejemplo y migraciones
    Common/                manejo global de errores y paginación
  tests/Inventory.Api.Tests/
frontend/src/app/
  core/                    URL de la API, errores HTTP (ProblemDetails) y configuración regional
  features/products/       servicio de API, listado y formulario
```

## API

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/categories` | Categorías ordenadas por nombre |
| GET | `/api/products` | Listado paginado. Query: `page`, `pageSize` (1-100), `search`, `categoryId`, `lowStock`, `sort` (`name`, `sku`, `price`, `stock`; prefijo `-` para descendente) |
| GET | `/api/products/{id}` | Detalle |
| POST | `/api/products` | Alta (201). SKU duplicado → 409 |
| PUT | `/api/products/{id}` | Modificación |
| DELETE | `/api/products/{id}` | Borrado (204) |
| GET | `/health` | Estado de la API |

En desarrollo, el documento OpenAPI está en `/openapi/v1.json`. Los errores se devuelven en formato ProblemDetails.

Un producto tiene **stock bajo** cuando su stock es igual o inferior a su stock mínimo.
