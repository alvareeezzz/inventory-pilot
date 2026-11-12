using Inventory.Api.Common;
using Inventory.Api.Data;
using Inventory.Api.Features.Categories;
using Inventory.Api.Features.Products;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddValidation();
builder.Services.AddHealthChecks();
builder.Services.AddSingleton(TimeProvider.System);

var connectionString = builder.Configuration.GetConnectionString("Inventory");
if (string.IsNullOrWhiteSpace(connectionString))
{
    throw new InvalidOperationException("Falta la cadena de conexión 'ConnectionStrings:Inventory'.");
}

builder.Services.AddDbContext<InventoryDbContext>(options => options.UseSqlServer(connectionString));

var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
builder.Services.AddCors(options =>
    options.AddDefaultPolicy(policy => policy.WithOrigins(allowedOrigins).AllowAnyHeader().AllowAnyMethod()));

var app = builder.Build();

app.UseExceptionHandler();
app.UseStatusCodePages();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();
app.UseCors();

app.MapHealthChecks("/health");

var api = app.MapGroup("/api");
api.MapCategoryEndpoints();
api.MapProductEndpoints();

app.Run();
