namespace Inventory.Api.Data;

public sealed class Product
{
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
