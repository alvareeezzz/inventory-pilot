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
   El servidor de Angular redirige `/api` a la API mediante `frontend/proxy.conf.json`, así que no hace falta confiar en el certificado HTTPS de desarrollo.

## Tests

```bash
cd backend && dotnet test     # crea y borra una base de datos LocalDB temporal por clase de test
cd frontend && npx ng test --watch=false
cd frontend && npx ng lint
```

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
