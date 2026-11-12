using Inventory.Api.Data;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace Inventory.Api.Features.Categories;

public sealed record CategoryResponse(int Id, string Name);

public static class CategoryEndpoints
{
    public static RouteGroupBuilder MapCategoryEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/categories", GetCategoriesAsync)
            .WithName("GetCategories")
            .WithTags("Categories");

        return api;
    }

    private static async Task<Ok<List<CategoryResponse>>> GetCategoriesAsync(InventoryDbContext db, CancellationToken ct)
    {
        var categories = await db.Categories
            .AsNoTracking()
            .OrderBy(c => c.Name)
            .Select(c => new CategoryResponse(c.Id, c.Name))
            .ToListAsync(ct);

        return TypedResults.Ok(categories);
    }
}
