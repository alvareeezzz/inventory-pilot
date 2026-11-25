using Microsoft.AspNetCore.Http;

namespace Inventory.Api.Common;

/// <summary>
/// Traduce al español los títulos por defecto (en inglés) de los ProblemDetails que genera ASP.NET Core.
/// Los títulos que ya pone la propia API (en español) no se tocan.
/// </summary>
internal static class SpanishProblemTitles
{
    private static readonly Dictionary<string, string> Titles = new(StringComparer.Ordinal)
    {
        ["One or more validation errors occurred."] = "Los datos enviados no son válidos.",
        ["Bad Request"] = "La petición no es válida.",
        ["Unauthorized"] = "No autorizado",
        ["Forbidden"] = "Acceso denegado",
        ["Not Found"] = "Recurso no encontrado",
        ["Method Not Allowed"] = "Método no permitido",
        ["Not Acceptable"] = "Formato no aceptado",
        ["Conflict"] = "Conflicto",
        ["Payload Too Large"] = "Petición demasiado grande",
        ["Unsupported Media Type"] = "Tipo de contenido no admitido",
        ["Unprocessable Entity"] = "No se puede procesar la petición",
        ["An error occurred while processing your request."] = "Se ha producido un error inesperado.",
    };

    public static void Apply(ProblemDetailsContext context)
    {
        if (context.ProblemDetails.Title is { } title && Titles.TryGetValue(title, out var spanish))
        {
            context.ProblemDetails.Title = spanish;
        }
    }
}
