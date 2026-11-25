using System.Net;
using System.Net.Http.Json;
using Inventory.Api.Data;
using Inventory.Api.Features.Products;
using Inventory.Api.Tests.Infrastructure;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

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
    public async Task CreateProduct_WithInvalidData_ReturnsSpanishMessages()
    {
        var request = NewRequest(sku: "bad sku!") with
        {
            Name = "",
            Description = new string('x', 501),
            CategoryId = 0,
            Price = 99_999_999m,
            Stock = -1,
            MinStock = 2_000_000,
        };

        var response = await _client.PostAsJsonAsync("/api/products", request);

        var problem = await response.Content.ReadFromJsonAsync<ValidationProblemDetails>();
        Assert.NotNull(problem);
        var errors = problem.Errors.ToDictionary(e => e.Key.ToLowerInvariant(), e => e.Value[0]);
        Assert.Equal("El SKU solo puede contener letras, números y guiones.", errors["sku"]);
        Assert.Equal("El nombre es obligatorio.", errors["name"]);
        Assert.Equal("La descripción no puede superar los 500 caracteres.", errors["description"]);
        Assert.Equal("Selecciona una categoría.", errors["categoryid"]);
        Assert.Equal("El precio debe estar entre 0,01 y 1.000.000.", errors["price"]);
        Assert.Equal("El stock debe ser un número entero entre 0 y 1.000.000.", errors["stock"]);
        Assert.Equal("El stock mínimo debe ser un número entero entre 0 y 1.000.000.", errors["minstock"]);
    }

    [Theory]
    [InlineData("{bad")] // JSON mal formado
    [InlineData("""{"sku":"TEST-BODY-1","name":"x","categoryId":1,"price":10,"stock":1.5,"minStock":0}""")] // decimal en un entero
    [InlineData("""{"sku":"TEST-BODY-2","name":"x","categoryId":1,"price":10,"stock":2147483648,"minStock":0}""")] // desborda Int32
    [InlineData("""{"sku":"TEST-BODY-3","name":"x","categoryId":1,"price":"abc","stock":1,"minStock":0}""")] // tipo incorrecto
    public async Task CreateProduct_WithUnreadableBody_ReturnsBadRequestProblem(string body)
    {
        using var content = new StringContent(body, System.Text.Encoding.UTF8, "application/json");

        var response = await CreateClientThatThrowsOnBadRequest().PostAsync("/api/products", content);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>();
        Assert.Equal((int)HttpStatusCode.BadRequest, problem?.Status);
    }

    [Fact]
    public async Task UpdateProduct_WithUnreadableBody_ReturnsBadRequest()
    {
        using var content = new StringContent("{bad", System.Text.Encoding.UTF8, "application/json");

        var response = await CreateClientThatThrowsOnBadRequest().PutAsync("/api/products/1", content);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    /// <summary>
    /// Cliente con ThrowOnBadRequest activado, como en Development: el cuerpo ilegible llega al
    /// manejador global de excepciones como BadHttpRequestException en lugar de resolverse con un 400 directo.
    /// </summary>
    private HttpClient CreateClientThatThrowsOnBadRequest() =>
        factory.WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
            services.Configure<RouteHandlerOptions>(options => options.ThrowOnBadRequest = true)))
        .CreateClient();

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
    public async Task CreateAndUpdate_UseMinimalDatabaseRoundTrips()
    {
        var counter = new CommandCounter();
        var client = factory.WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
            services.ConfigureDbContext<InventoryDbContext>(options => options.AddInterceptors(counter))))
            .CreateClient();

        // Crear: comprobar la categoría, comprobar el SKU e INSERT.
        var createResponse = await client.PostAsJsonAsync("/api/products", NewRequest("TEST-TRIPS-1"));
        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
        Assert.Equal(3, counter.Count);
        var created = (await createResponse.Content.ReadFromJsonAsync<ProductResponse>())!;
        Assert.Equal("Electronics", created.CategoryName);

        // Editar sin cambiar SKU ni categoría (lo habitual): leer el producto con su categoría y UPDATE.
        counter.Reset();
        var sameResponse = await client.PutAsJsonAsync(
            $"/api/products/{created.Id}", NewRequest("test-trips-1") with { Price = 99m });
        Assert.Equal(HttpStatusCode.OK, sameResponse.StatusCode);
        Assert.Equal(2, counter.Count);
        var same = (await sameResponse.Content.ReadFromJsonAsync<ProductResponse>())!;
        Assert.Equal("Electronics", same.CategoryName);
        Assert.Equal(99m, same.Price);

        // Editar cambiando de categoría: además, cargar la categoría nueva.
        counter.Reset();
        var updateResponse = await client.PutAsJsonAsync(
            $"/api/products/{created.Id}", NewRequest("TEST-TRIPS-1") with { CategoryId = 3, Stock = 1, MinStock = 5 });
        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
        Assert.Equal(3, counter.Count);
        var updated = (await updateResponse.Content.ReadFromJsonAsync<ProductResponse>())!;
        Assert.Equal(3, updated.CategoryId);
        Assert.Equal("Furniture", updated.CategoryName);
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
