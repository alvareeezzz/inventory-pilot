using System.Net;
using System.Net.Http.Json;
using Inventory.Api.Common;
using Inventory.Api.Features.Categories;
using Inventory.Api.Features.Products;
using Inventory.Api.Tests.Infrastructure;
using Microsoft.AspNetCore.Mvc;

namespace Inventory.Api.Tests.Features.Products;

/// <summary>Tests de solo lectura: trabajan sobre los datos de ejemplo sin modificarlos.</summary>
public sealed class ProductReadEndpointsTests(InventoryApiFactory factory) : IClassFixture<InventoryApiFactory>
{
    private readonly HttpClient _client = factory.CreateClient();

    [Fact]
    public async Task GetProducts_WithDefaults_ReturnsFirstPageOrderedByName()
    {
        var page = await _client.GetFromJsonAsync<PagedResponse<ProductResponse>>("/api/products");

        Assert.NotNull(page);
        Assert.Equal(8, page.TotalCount);
        Assert.Equal(1, page.Page);
        Assert.Equal(ProductQuery.DefaultPageSize, page.PageSize);
        Assert.Equal(8, page.Items.Count);
        Assert.Equal(page.Items.Select(p => p.Name).Order(StringComparer.OrdinalIgnoreCase), page.Items.Select(p => p.Name));
    }

    [Fact]
    public async Task GetProducts_WithPageSize_PaginatesResults()
    {
        var page = await _client.GetFromJsonAsync<PagedResponse<ProductResponse>>("/api/products?page=2&pageSize=3");

        Assert.NotNull(page);
        Assert.Equal(3, page.Items.Count);
        Assert.Equal(3, page.TotalPages);
    }

    [Fact]
    public async Task GetProducts_WithLowStock_ReturnsOnlyLowStockProducts()
    {
        var page = await _client.GetFromJsonAsync<PagedResponse<ProductResponse>>("/api/products?lowStock=true");

        Assert.NotNull(page);
        Assert.Equal(4, page.TotalCount);
        Assert.All(page.Items, p => Assert.True(p.IsLowStock));
    }

    [Fact]
    public async Task GetProducts_WithSearchAndCategory_CombinesFilters()
    {
        var page = await _client.GetFromJsonAsync<PagedResponse<ProductResponse>>("/api/products?search=chair&categoryId=3");

        Assert.NotNull(page);
        var product = Assert.Single(page.Items);
        Assert.Equal("FURN-0001", product.Sku);
        Assert.Equal("Furniture", product.CategoryName);
    }

    [Theory]
    [InlineData("pageSize=0")]
    [InlineData("pageSize=101")]
    [InlineData("page=0")]
    [InlineData("sort=color")]
    public async Task GetProducts_WithInvalidQuery_ReturnsValidationProblem(string queryString)
    {
        var response = await _client.GetAsync($"/api/products?{queryString}");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task GetProduct_WithExistingId_ReturnsProduct()
    {
        var product = await _client.GetFromJsonAsync<ProductResponse>("/api/products/2");

        Assert.NotNull(product);
        Assert.Equal("ELEC-0002", product.Sku);
        Assert.True(product.IsLowStock);
    }

    [Fact]
    public async Task GetProduct_WithUnknownId_ReturnsNotFound()
    {
        var response = await _client.GetAsync("/api/products/999999");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Theory]
    [InlineData("GET")]
    [InlineData("PUT")]
    [InlineData("DELETE")]
    public async Task ProductEndpoints_WithUnknownId_ReturnSpanishProblem(string method)
    {
        using var request = new HttpRequestMessage(new HttpMethod(method), "/api/products/999999");
        if (method == "PUT")
        {
            request.Content = JsonContent.Create(new ProductRequest
            {
                Sku = "TEST-404", Name = "Test", CategoryId = 1, Price = 1m, Stock = 1, MinStock = 0,
            });
        }

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>();
        Assert.Equal("Producto no encontrado", problem?.Title);
        Assert.Equal("No existe ningún producto con el id 999999.", problem?.Detail);
    }

    [Fact]
    public async Task UnknownRoute_ReturnsSpanishProblem()
    {
        var response = await _client.GetAsync("/api/does-not-exist");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>();
        Assert.Equal("Recurso no encontrado", problem?.Title);
    }

    [Fact]
    public async Task GetProducts_WithInvalidQuery_ReturnsSpanishTitle()
    {
        var response = await _client.GetAsync("/api/products?pageSize=0");

        var problem = await response.Content.ReadFromJsonAsync<ValidationProblemDetails>();
        Assert.Equal("Los datos enviados no son válidos.", problem?.Title);
    }

    [Fact]
    public async Task GetCategories_ReturnsCategoriesOrderedByName()
    {
        var categories = await _client.GetFromJsonAsync<List<CategoryResponse>>("/api/categories");

        Assert.NotNull(categories);
        Assert.Equal(["Electronics", "Furniture", "Office"], categories.Select(c => c.Name));
    }

    [Fact]
    public async Task Health_ReturnsHealthy()
    {
        var response = await _client.GetAsync("/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("Healthy", await response.Content.ReadAsStringAsync());
    }
}
