using System.Linq.Expressions;
using Inventory.Api.Data;

namespace Inventory.Api.Features.Products;

internal static class ProductQueryExtensions
{
    /// <summary>Proyección a DTO traducible a SQL. Stock bajo = stock igual o inferior al mínimo.</summary>
    public static readonly Expression<Func<Product, ProductResponse>> ToResponse = p => new ProductResponse(
        p.Id,
        p.Sku,
        p.Name,
        p.Description,
        p.CategoryId,
        p.Category!.Name,
        p.Price,
        p.Stock,
        p.MinStock,
        p.Stock <= p.MinStock,
        p.CreatedAt,
        p.UpdatedAt);

    /// <summary>La misma proyección en memoria, para una entidad recién guardada con su categoría cargada.</summary>
    public static readonly Func<Product, ProductResponse> ToResponseInMemory = ToResponse.Compile();

    public static IQueryable<Product> ApplyFilters(this IQueryable<Product> source, ProductQuery query)
    {
        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            // En SQL Server la comparación no distingue mayúsculas (collation por defecto).
            var term = query.Search.Trim();
            source = source.Where(p => p.Name.Contains(term) || p.Sku.Contains(term));
        }

        if (query.CategoryId is int categoryId)
        {
            source = source.Where(p => p.CategoryId == categoryId);
        }

        if (query.LowStock == true)
        {
            source = source.Where(p => p.Stock <= p.MinStock);
        }

        return source;
    }

    /// <summary>Ordena por el campo pedido y desempata por Id para que la paginación sea estable.</summary>
    public static IQueryable<Product> ApplySort(this IQueryable<Product> source, string? sort)
    {
        var ordered = sort switch
        {
            "-name" => source.OrderByDescending(p => p.Name),
            "sku" => source.OrderBy(p => p.Sku),
            "-sku" => source.OrderByDescending(p => p.Sku),
            "price" => source.OrderBy(p => p.Price),
            "-price" => source.OrderByDescending(p => p.Price),
            "stock" => source.OrderBy(p => p.Stock),
            "-stock" => source.OrderByDescending(p => p.Stock),
            _ => source.OrderBy(p => p.Name),
        };

        return ordered.ThenBy(p => p.Id);
    }
}
