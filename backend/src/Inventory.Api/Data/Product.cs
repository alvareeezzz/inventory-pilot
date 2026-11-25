namespace Inventory.Api.Data;

public sealed class Product
{
    // Límites compartidos por la base de datos (ProductConfiguration) y la validación de la API
    // (ProductRequest). El frontend tiene los mismos en PRODUCT_RULES (product.models.ts) y el e2e
    // validation-limits comprueba que coinciden.
    public const int SkuMaxLength = 32;
    public const int NameMaxLength = 100;
    public const int DescriptionMaxLength = 500;
    public const string MinPrice = "0.01";
    public const string MaxPrice = "1000000";
    public const int MaxQuantity = 1_000_000;

    /// <summary>Letras, números y guiones (se admiten espacios alrededor porque el SKU se recorta).</summary>
    public const string SkuPattern = @"^\s*[A-Za-z0-9-]+\s*$";

    public int Id { get; set; }

    /// <summary>Código único del producto, siempre en mayúsculas.</summary>
    public required string Sku { get; set; }

    public required string Name { get; set; }

    public string? Description { get; set; }

    public int CategoryId { get; set; }

    public Category? Category { get; set; }

    public decimal Price { get; set; }

    public int Stock { get; set; }

    /// <summary>Stock mínimo: con <see cref="Stock"/> igual o inferior, el producto tiene stock bajo.</summary>
    public int MinStock { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset? UpdatedAt { get; set; }
}
