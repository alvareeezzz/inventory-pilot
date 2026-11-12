using System.Net;
using System.Net.Http.Json;
using Inventory.Api.Features.Products;
using Inventory.Api.Tests.Infrastructure;
using Microsoft.AspNetCore.Mvc;

namespace Inventory.Api.Tests.Features.Products;

/// <summary>Tests que crean, modifican y borran productos. Cada test usa SKUs propios para no depender del orden.</summary>
public sealed class ProductWriteEndpointsTests(InventoryApiFactory factory) : IClassFixture<InventoryApiFactory>
{
    private readonly HttpClient _client = factory.CreateClient();

    [Fact]
    public async Task CreateProduct_WithValidData_ReturnsCreatedWithNormalizedSku()
    {
        var request = NewRequest(sku: " test-create-1 ") with { Name = "  Desk lamp  ", Description = "  " };

        var response = await _client.PostAsJsonAsync("/api/products", request);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var created = await response.Content.ReadFromJsonAsync<ProductResponse>();
        Assert.NotNull(created);
        Assert.Equal("TEST-CREATE-1", created.Sku);
        Assert.Equal("Desk lamp", created.Name);
        Assert.Null(created.Description);
        Assert.Equal("Electronics", created.CategoryName);
        Assert.Null(created.UpdatedAt);
        Assert.Equal($"/api/products/{created.Id}", response.Headers.Location?.AbsolutePath);
    }

    [Fact]
    public async Task CreateProduct_WithInvalidData_ReturnsValidationErrorsPerField()
    {
        var request = NewRequest(sku: "bad sku!") with { Name = "", Price = 0m, Stock = -1 };

        var response = await _client.PostAsJsonAsync("/api/products", request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<ValidationProblemDetails>();
        Assert.NotNull(problem);
        var fields = problem.Errors.Keys.Select(k => k.ToLowerInvariant()).ToList();
        Assert.Contains("sku", fields);
        Assert.Contains("name", fields);
        Assert.Contains("price", fields);
        Assert.Contains("stock", fields);
    }

    [Fact]
    public async Task CreateProduct_WithUnknownCategory_ReturnsValidationProblem()
    {
        var response = await _client.PostAsJsonAsync("/api/products", NewRequest("TEST-CAT-1") with { CategoryId = 999 });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<ValidationProblemDetails>();
        Assert.Contains(nameof(ProductRequest.CategoryId), problem!.Errors.Keys);
    }

    [Fact]
    public async Task CreateProduct_WithDuplicateSku_ReturnsConflict()
    {
        // ELEC-0001 existe en los datos de ejemplo; se envía en minúsculas para comprobar la normalización.
        var response = await _client.PostAsJsonAsync("/api/products", NewRequest("elec-0001"));

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task UpdateProduct_WithValidData_UpdatesFieldsAndTimestamp()
    {
        var created = await CreateAsync("TEST-UPD-1");

        var response = await _client.PutAsJsonAsync(
            $"/api/products/{created.Id}",
            NewRequest("TEST-UPD-1") with { Name = "Renamed", CategoryId = 3, Price = 99.95m, Stock = 1, MinStock = 4 });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var updated = await response.Content.ReadFromJsonAsync<ProductResponse>();
        Assert.NotNull(updated);
        Assert.Equal("Renamed", updated.Name);
        Assert.Equal("Furniture", updated.CategoryName);
        Assert.Equal(99.95m, updated.Price);
        Assert.True(updated.IsLowStock);
        Assert.NotNull(updated.UpdatedAt);
    }

    [Fact]
    public async Task UpdateProduct_WithSkuOfAnotherProduct_ReturnsConflict()
    {
        var created = await CreateAsync("TEST-UPD-2");

        var response = await _client.PutAsJsonAsync($"/api/products/{created.Id}", NewRequest("ELEC-0002"));

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task UpdateProduct_KeepingItsOwnSku_Succeeds()
    {
        var created = await CreateAsync("TEST-UPD-3");

        var response = await _client.PutAsJsonAsync($"/api/products/{created.Id}", NewRequest("test-upd-3"));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task UpdateProduct_WithUnknownId_ReturnsNotFound()
    {
        var response = await _client.PutAsJsonAsync("/api/products/999999", NewRequest("TEST-UPD-404"));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task DeleteProduct_WithExistingId_RemovesProduct()
    {
        var created = await CreateAsync("TEST-DEL-1");

        var deleteResponse = await _client.DeleteAsync($"/api/products/{created.Id}");
        var getResponse = await _client.GetAsync($"/api/products/{created.Id}");

        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, getResponse.StatusCode);
    }

    [Fact]
    public async Task DeleteProduct_WithUnknownId_ReturnsNotFound()
    {
        var response = await _client.DeleteAsync("/api/products/999999");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    private async Task<ProductResponse> CreateAsync(string sku)
    {
        var response = await _client.PostAsJsonAsync("/api/products", NewRequest(sku));
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<ProductResponse>())!;
    }

    private static ProductRequest NewRequest(string sku) => new()
    {
        Sku = sku,
        Name = "Test product",
        Description = "Created by integration tests",
        CategoryId = 1,
        Price = 12.50m,
        Stock = 20,
        MinStock = 5,
    };
}
