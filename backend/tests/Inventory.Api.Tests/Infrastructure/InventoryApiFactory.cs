using Inventory.Api.Data;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Inventory.Api.Tests.Infrastructure;

/// <summary>
/// Arranca la API en memoria contra una base de datos LocalDB propia (nombre único),
/// la crea con las migraciones (incluye los datos de ejemplo) y la borra al terminar.
/// </summary>
public sealed class InventoryApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private readonly string _connectionString =
        $"Server=(localdb)\\MSSQLLocalDB;Database=InventoryPilot_Tests_{Guid.NewGuid():N};Trusted_Connection=True;TrustServerCertificate=True";

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("ConnectionStrings:Inventory", _connectionString);
    }

    public async Task InitializeAsync()
    {
        using var scope = Services.CreateScope();
        await scope.ServiceProvider.GetRequiredService<InventoryDbContext>().Database.MigrateAsync();
    }

    async Task IAsyncLifetime.DisposeAsync()
    {
        using (var scope = Services.CreateScope())
        {
            await scope.ServiceProvider.GetRequiredService<InventoryDbContext>().Database.EnsureDeletedAsync();
        }

        await DisposeAsync();
    }
}
