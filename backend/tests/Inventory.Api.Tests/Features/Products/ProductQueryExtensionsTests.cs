using Inventory.Api.Data;
using Inventory.Api.Features.Products;

namespace Inventory.Api.Tests.Features.Products;

public sealed class ProductQueryExtensionsTests
{
    private static readonly Product[] Products =
    [
        NewProduct(1, "B-001", "Banana stand", categoryId: 1, price: 30m, stock: 5, minStock: 5),
        NewProduct(2, "A-001", "Apple crate", categoryId: 1, price: 10m, stock: 50, minStock: 5),
        NewProduct(3, "C-001", "Cherry box", categoryId: 2, price: 20m, stock: 0, minStock: 1),
        NewProduct(4, "D-001", "Apple juice", categoryId: 2, price: 20m, stock: 9, minStock: 3),
    ];

    [Fact]
    public void ApplyFilters_WithoutFilters_ReturnsAllProducts()
    {
        var result = Products.AsQueryable().ApplyFilters(new ProductQuery()).ToList();

        Assert.Equal(4, result.Count);
    }

    [Fact]
    public void ApplyFilters_WithSearch_MatchesNameOrSku()
    {
        var byName = Products.AsQueryable().ApplyFilters(new ProductQuery { Search = "Apple" }).Select(p => p.Id);
        var bySku = Products.AsQueryable().ApplyFilters(new ProductQuery { Search = " C-001 " }).Select(p => p.Id);

        Assert.Equal([2, 4], byName.OrderBy(id => id));
        Assert.Equal([3], bySku);
    }

    [Fact]
    public void ApplyFilters_WithCategory_ReturnsOnlyThatCategory()
    {
        var result = Products.AsQueryable().ApplyFilters(new ProductQuery { CategoryId = 2 }).Select(p => p.Id);

        Assert.Equal([3, 4], result.OrderBy(id => id));
    }

    [Fact]
    public void ApplyFilters_WithLowStock_IncludesStockEqualToMinimum()
    {
        var result = Products.AsQueryable().ApplyFilters(new ProductQuery { LowStock = true }).Select(p => p.Id);

        Assert.Equal([1, 3], result.OrderBy(id => id));
    }

    [Theory]
    [InlineData(null, new[] { 2, 4, 1, 3 })]
    [InlineData("-name", new[] { 3, 1, 4, 2 })]
    [InlineData("price", new[] { 2, 3, 4, 1 })]
    [InlineData("-stock", new[] { 2, 4, 1, 3 })]
    [InlineData("sku", new[] { 2, 1, 3, 4 })]
    public void ApplySort_OrdersByRequestedField(string? sort, int[] expectedIds)
    {
        var result = Products.AsQueryable().ApplySort(sort).Select(p => p.Id);

        Assert.Equal(expectedIds, result);
    }

    [Fact]
    public void ApplySort_WithTies_BreaksTieById()
    {
        // Los productos 3 y 4 tienen el mismo precio: el desempate por Id hace estable la paginación.
        var result = Products.AsQueryable().ApplySort("-price").Select(p => p.Id);

        Assert.Equal([1, 3, 4, 2], result);
    }

    private static Product NewProduct(int id, string sku, string name, int categoryId, decimal price, int stock, int minStock) =>
        new()
        {
            Id = id,
            Sku = sku,
            Name = name,
            CategoryId = categoryId,
            Price = price,
            Stock = stock,
            MinStock = minStock,
        };
}
