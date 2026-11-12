namespace Inventory.Api.Data;

/// <summary>Datos de ejemplo que las migraciones insertan al crear la base de datos.</summary>
internal static class SeedData
{
    private static readonly DateTimeOffset SeedDate = new(2026, 1, 1, 0, 0, 0, TimeSpan.Zero);

    public static readonly Category[] Categories =
    [
        new() { Id = 1, Name = "Electronics" },
        new() { Id = 2, Name = "Office" },
        new() { Id = 3, Name = "Furniture" },
    ];

    public static readonly Product[] Products =
    [
        Create(1, "ELEC-0001", "Wireless mouse", "Ergonomic 2.4 GHz mouse", 1, 19.99m, 45, 10),
        Create(2, "ELEC-0002", "Mechanical keyboard", "Spanish layout, brown switches", 1, 89.90m, 4, 5),
        Create(3, "ELEC-0003", "27\" monitor", "QHD IPS panel", 1, 249.00m, 12, 3),
        Create(4, "ELEC-0004", "USB-C hub", "7-in-1 adapter", 1, 34.50m, 2, 8),
        Create(5, "OFF-0001", "A4 paper pack", "500 sheets, 80 g/m²", 2, 5.75m, 120, 30),
        Create(6, "OFF-0002", "Gel pens (12)", "Assorted colours", 2, 8.20m, 6, 10),
        Create(7, "FURN-0001", "Office chair", "Adjustable lumbar support", 3, 179.00m, 7, 2),
        Create(8, "FURN-0002", "Standing desk", "Electric, 140x70 cm", 3, 399.00m, 0, 1),
    ];

    private static Product Create(
        int id, string sku, string name, string description, int categoryId, decimal price, int stock, int minStock) =>
        new()
        {
            Id = id,
            Sku = sku,
            Name = name,
            Description = description,
            CategoryId = categoryId,
            Price = price,
            Stock = stock,
            MinStock = minStock,
            CreatedAt = SeedDate,
        };
}
