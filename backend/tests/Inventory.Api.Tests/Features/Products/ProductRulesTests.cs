using System.ComponentModel.DataAnnotations;
using System.Globalization;
using System.Reflection;
using Inventory.Api.Data;
using Inventory.Api.Features.Products;
using Microsoft.EntityFrameworkCore;

namespace Inventory.Api.Tests.Features.Products;

/// <summary>
/// Los límites de producto viven en constantes de <see cref="Product"/>; los mensajes de validación los
/// repiten en texto. Estos tests detectan si un límite cambia y su mensaje o la base de datos no.
/// </summary>
public sealed class ProductRulesTests
{
    private static readonly CultureInfo Spanish = CultureInfo.GetCultureInfo("es-ES");

    public static TheoryData<string> RequestProperties() =>
        new(typeof(ProductRequest).GetProperties().Select(p => p.Name));

    [Theory]
    [MemberData(nameof(RequestProperties))]
    public void ValidationMessages_ContainTheirLimits(string propertyName)
    {
        var property = typeof(ProductRequest).GetProperty(propertyName)!;

        if (property.GetCustomAttribute<StringLengthAttribute>() is { } length)
        {
            Assert.Contains(length.MaximumLength.ToString(Spanish), length.ErrorMessage);
        }

        if (property.GetCustomAttribute<RangeAttribute>() is { } range && range.Maximum is not int.MaxValue)
        {
            var maximum = Convert.ToDecimal(range.Maximum, CultureInfo.InvariantCulture);
            Assert.Contains(maximum.ToString("N0", Spanish), range.ErrorMessage);
        }
    }

    [Theory]
    [InlineData(nameof(Product.Sku), Product.SkuMaxLength)]
    [InlineData(nameof(Product.Name), Product.NameMaxLength)]
    [InlineData(nameof(Product.Description), Product.DescriptionMaxLength)]
    public void DatabaseColumns_UseTheSameMaxLength(string propertyName, int expected)
    {
        var options = new DbContextOptionsBuilder<InventoryDbContext>().UseSqlServer("Server=unused").Options;
        using var db = new InventoryDbContext(options);

        var property = db.Model.FindEntityType(typeof(Product))!.FindProperty(propertyName)!;

        Assert.Equal(expected, property.GetMaxLength());
    }
}
