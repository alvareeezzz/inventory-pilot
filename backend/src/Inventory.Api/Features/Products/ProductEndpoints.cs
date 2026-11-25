using Inventory.Api.Common;
using Inventory.Api.Data;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace Inventory.Api.Features.Products;

public static class ProductEndpoints
{
    public static RouteGroupBuilder MapProductEndpoints(this RouteGroupBuilder api)
    {
        var group = api.MapGroup("/products").WithTags("Products");

        group.MapGet("/", GetProductsAsync).WithName("GetProducts");
        group.MapGet("/{id:int}", GetProductAsync).WithName("GetProduct")
            .ProducesProblem(StatusCodes.Status404NotFound);
        group.MapPost("/", CreateProductAsync).WithName("CreateProduct");
        group.MapPut("/{id:int}", UpdateProductAsync).WithName("UpdateProduct")
            .ProducesProblem(StatusCodes.Status404NotFound);
        group.MapDelete("/{id:int}", DeleteProductAsync).WithName("DeleteProduct")
            .ProducesProblem(StatusCodes.Status404NotFound);

        return api;
    }

    private static async Task<Ok<PagedResponse<ProductResponse>>> GetProductsAsync(
        [AsParameters] ProductQuery query,
        InventoryDbContext db,
        CancellationToken ct)
    {
        var page = query.PageOrDefault;
        var pageSize = query.PageSizeOrDefault;
        var filtered = db.Products.AsNoTracking().ApplyFilters(query);

        var totalCount = await filtered.CountAsync(ct);
        var items = await filtered
            .ApplySort(query.Sort)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(ProductQueryExtensions.ToResponse)
            .ToListAsync(ct);

        return TypedResults.Ok(new PagedResponse<ProductResponse>(items, page, pageSize, totalCount));
    }

    private static async Task<Results<Ok<ProductResponse>, ProblemHttpResult>> GetProductAsync(
        int id,
        InventoryDbContext db,
        CancellationToken ct)
    {
        var product = await FindResponseAsync(db, id, ct);
        return product is null ? ProductNotFound(id) : TypedResults.Ok(product);
    }

    private static async Task<Results<CreatedAtRoute<ProductResponse>, ValidationProblem, Conflict<ProblemDetails>>> CreateProductAsync(
        ProductRequest request,
        InventoryDbContext db,
        TimeProvider clock,
        CancellationToken ct)
    {
        var sku = NormalizeSku(request.Sku);

        // Se carga la categoría (y no solo se comprueba) para construir la respuesta sin volver a consultar.
        var category = await db.Categories.FindAsync([request.CategoryId], ct);
        if (category is null)
        {
            return UnknownCategory(request.CategoryId);
        }

        if (await db.Products.AnyAsync(p => p.Sku == sku, ct))
        {
            return DuplicateSku(sku);
        }

        var product = new Product
        {
            Sku = sku,
            Name = request.Name.Trim(),
            Description = NormalizeDescription(request.Description),
            CategoryId = category.Id,
            Category = category,
            Price = request.Price,
            Stock = request.Stock,
            MinStock = request.MinStock,
            CreatedAt = clock.GetUtcNow(),
        };

        db.Products.Add(product);
        if (!await TrySaveAsync(db, ct))
        {
            return DuplicateSku(sku);
        }

        var response = ProductQueryExtensions.ToResponseInMemory(product);
        return TypedResults.CreatedAtRoute(response, "GetProduct", new { id = product.Id });
    }

    private static async Task<Results<Ok<ProductResponse>, ProblemHttpResult, ValidationProblem, Conflict<ProblemDetails>>> UpdateProductAsync(
        int id,
        ProductRequest request,
        InventoryDbContext db,
        TimeProvider clock,
        CancellationToken ct)
    {
        // Con su categoría (mismo viaje): si no cambia, FindAsync la encuentra ya cargada sin consultar.
        var product = await db.Products.Include(p => p.Category).FirstOrDefaultAsync(p => p.Id == id, ct);
        if (product is null)
        {
            return ProductNotFound(id);
        }

        var sku = NormalizeSku(request.Sku);

        var category = await db.Categories.FindAsync([request.CategoryId], ct);
        if (category is null)
        {
            return UnknownCategory(request.CategoryId);
        }

        // El SKU guardado ya está normalizado: solo se comprueba si cambia (el índice único cubre las carreras).
        if (sku != product.Sku && await db.Products.AnyAsync(p => p.Sku == sku && p.Id != id, ct))
        {
            return DuplicateSku(sku);
        }

        product.Sku = sku;
        product.Name = request.Name.Trim();
        product.Description = NormalizeDescription(request.Description);
        product.CategoryId = category.Id;
        product.Category = category;
        product.Price = request.Price;
        product.Stock = request.Stock;
        product.MinStock = request.MinStock;
        product.UpdatedAt = clock.GetUtcNow();

        if (!await TrySaveAsync(db, ct))
        {
            return DuplicateSku(sku);
        }

        return TypedResults.Ok(ProductQueryExtensions.ToResponseInMemory(product));
    }

    private static async Task<Results<NoContent, ProblemHttpResult>> DeleteProductAsync(
        int id,
        InventoryDbContext db,
        CancellationToken ct)
    {
        var deleted = await db.Products.Where(p => p.Id == id).ExecuteDeleteAsync(ct);
        return deleted == 0 ? ProductNotFound(id) : TypedResults.NoContent();
    }

    private static Task<ProductResponse?> FindResponseAsync(InventoryDbContext db, int id, CancellationToken ct) =>
        db.Products
            .AsNoTracking()
            .Where(p => p.Id == id)
            .Select(ProductQueryExtensions.ToResponse)
            .FirstOrDefaultAsync(ct);

    /// <summary>Guarda cambios; devuelve false si otro proceso insertó el mismo SKU entre la comprobación y el guardado.</summary>
    private static async Task<bool> TrySaveAsync(InventoryDbContext db, CancellationToken ct)
    {
        try
        {
            await db.SaveChangesAsync(ct);
            return true;
        }
        catch (DbUpdateException ex) when (ex.InnerException is SqlException { Number: 2601 or 2627 })
        {
            return false;
        }
    }

    private static string NormalizeSku(string sku) => sku.Trim().ToUpperInvariant();

    private static string? NormalizeDescription(string? description) =>
        string.IsNullOrWhiteSpace(description) ? null : description.Trim();

    private static ValidationProblem UnknownCategory(int categoryId) =>
        TypedResults.ValidationProblem(new Dictionary<string, string[]>
        {
            [nameof(ProductRequest.CategoryId)] = [$"La categoría {categoryId} no existe."],
        });

    // TypedResults.Problem (y no NotFound(value)) para responder con application/problem+json.
    private static ProblemHttpResult ProductNotFound(int id) =>
        TypedResults.Problem(
            statusCode: StatusCodes.Status404NotFound,
            title: "Producto no encontrado",
            detail: $"No existe ningún producto con el id {id}.");

    private static Conflict<ProblemDetails> DuplicateSku(string sku) =>
        TypedResults.Conflict(new ProblemDetails
        {
            Status = StatusCodes.Status409Conflict,
            Title = "SKU duplicado",
            Detail = $"Ya existe un producto con el SKU {sku}.",
        });
}
