using System.ComponentModel.DataAnnotations;
using Inventory.Api.Data;

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
    // Límites en Product (compartidos con la base de datos). Mensajes en español: se muestran tal cual en
    // el formulario del frontend; si cambia un límite, hay que actualizar su mensaje (lo comprueban los tests).
    [Required(ErrorMessage = "El SKU es obligatorio.")]
    [StringLength(Product.SkuMaxLength, ErrorMessage = "El SKU no puede superar los 32 caracteres.")]
    [RegularExpression(Product.SkuPattern, ErrorMessage = "El SKU solo puede contener letras, números y guiones.")]
    public string Sku { get; init; } = string.Empty;

    [Required(ErrorMessage = "El nombre es obligatorio.")]
    [StringLength(Product.NameMaxLength, ErrorMessage = "El nombre no puede superar los 100 caracteres.")]
    public string Name { get; init; } = string.Empty;

    [StringLength(Product.DescriptionMaxLength, ErrorMessage = "La descripción no puede superar los 500 caracteres.")]
    public string? Description { get; init; }

    [Range(1, int.MaxValue, ErrorMessage = "Selecciona una categoría.")]
    public int CategoryId { get; init; }

    [Range(typeof(decimal), Product.MinPrice, Product.MaxPrice, ParseLimitsInInvariantCulture = true, ConvertValueInInvariantCulture = true,
        ErrorMessage = "El precio debe estar entre 0,01 y 1.000.000.")]
    public decimal Price { get; init; }

    [Range(0, Product.MaxQuantity, ErrorMessage = "El stock debe ser un número entero entre 0 y 1.000.000.")]
    public int Stock { get; init; }

    [Range(0, Product.MaxQuantity, ErrorMessage = "El stock mínimo debe ser un número entero entre 0 y 1.000.000.")]
    public int MinStock { get; init; }
}

/// <summary>Parámetros del listado de productos (query string).</summary>
public sealed class ProductQuery
{
    public const int DefaultPageSize = 10;
    public const int MaxPageSize = 100;

    /// <summary>Longitud máxima de la búsqueda (el frontend tiene la misma en PRODUCT_RULES.searchMaxLength).</summary>
    public const int SearchMaxLength = 100;

    // Nullable: con [AsParameters] un int no anulable se considera obligatorio en la query string.
    [Range(1, int.MaxValue, ErrorMessage = "La página debe ser mayor o igual que 1.")]
    public int? Page { get; init; }

    [Range(1, MaxPageSize, ErrorMessage = "El tamaño de página debe estar entre 1 y 100.")]
    public int? PageSize { get; init; }

    public int PageOrDefault => Page ?? 1;

    public int PageSizeOrDefault => PageSize ?? DefaultPageSize;

    [StringLength(SearchMaxLength, ErrorMessage = "La búsqueda no puede superar los 100 caracteres.")]
    public string? Search { get; init; }

    public int? CategoryId { get; init; }

    public bool? LowStock { get; init; }

    /// <summary>Campo de orden; con prefijo "-" es descendente.</summary>
    [RegularExpression("^-?(name|sku|price|stock)$", ErrorMessage = "El orden debe ser name, sku, price o stock (con el prefijo '-' para orden descendente).")]
    public string? Sort { get; init; }
}
