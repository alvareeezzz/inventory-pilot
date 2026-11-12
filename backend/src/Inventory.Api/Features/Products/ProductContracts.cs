using System.ComponentModel.DataAnnotations;

namespace Inventory.Api.Features.Products;

public sealed record ProductResponse(
    int Id,
    string Sku,
    string Name,
    string? Description,
    int CategoryId,
    string CategoryName,
    decimal Price,
    int Stock,
    int MinStock,
    bool IsLowStock,
    DateTimeOffset CreatedAt,
    DateTimeOffset? UpdatedAt);

/// <summary>Datos para crear o actualizar un producto.</summary>
public sealed record ProductRequest
{
    [Required]
    [StringLength(32)]
    // Se admiten espacios alrededor porque el SKU se recorta y pasa a mayúsculas al guardarlo.
    [RegularExpression(@"^\s*[A-Za-z0-9-]+\s*$", ErrorMessage = "The SKU may only contain letters, digits and hyphens.")]
    public string Sku { get; init; } = string.Empty;

    [Required]
    [StringLength(100)]
    public string Name { get; init; } = string.Empty;

    [StringLength(500)]
    public string? Description { get; init; }

    [Range(1, int.MaxValue)]
    public int CategoryId { get; init; }

    [Range(typeof(decimal), "0.01", "1000000", ParseLimitsInInvariantCulture = true, ConvertValueInInvariantCulture = true)]
    public decimal Price { get; init; }

    [Range(0, 1_000_000)]
    public int Stock { get; init; }

    [Range(0, 1_000_000)]
    public int MinStock { get; init; }
}

/// <summary>Parámetros del listado de productos (query string).</summary>
public sealed class ProductQuery
{
    public const int DefaultPageSize = 10;
    public const int MaxPageSize = 100;

    // Nullable: con [AsParameters] un int no anulable se considera obligatorio en la query string.
    [Range(1, int.MaxValue)]
    public int? Page { get; init; }

    [Range(1, MaxPageSize)]
    public int? PageSize { get; init; }

    public int PageOrDefault => Page ?? 1;

    public int PageSizeOrDefault => PageSize ?? DefaultPageSize;

    [StringLength(100)]
    public string? Search { get; init; }

    public int? CategoryId { get; init; }

    public bool? LowStock { get; init; }

    /// <summary>Campo de orden; con prefijo "-" es descendente.</summary>
    [RegularExpression("^-?(name|sku|price|stock)$", ErrorMessage = "Sort must be one of: name, sku, price, stock (prefix with '-' for descending).")]
    public string? Sort { get; init; }
}
