using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace Inventory.Api.Common;

/// <summary>
/// Convierte las excepciones no controladas en respuestas ProblemDetails sin exponer detalles internos.
/// Las peticiones mal formadas (BadHttpRequestException: JSON ilegible, tipos incorrectos...) devuelven su
/// código 4xx; el resto, un 500.
/// </summary>
internal sealed class GlobalExceptionHandler(
    IProblemDetailsService problemDetailsService,
    ILogger<GlobalExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        var problem = exception is BadHttpRequestException badRequest
            ? BadRequestProblem(httpContext, badRequest)
            : ServerErrorProblem(httpContext, exception);

        httpContext.Response.StatusCode = problem.Status!.Value;
        return await problemDetailsService.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            Exception = exception,
            ProblemDetails = problem,
        });
    }

    private ProblemDetails BadRequestProblem(HttpContext httpContext, BadHttpRequestException exception)
    {
        // Es un error del cliente, no de la API: se registra como aviso y no se expone el mensaje interno.
        logger.LogWarning(exception, "Bad request processing {Method} {Path}", httpContext.Request.Method, httpContext.Request.Path);

        return new ProblemDetails
        {
            Status = exception.StatusCode,
            Title = "La petición no es válida.",
            Detail = "El cuerpo de la petición no tiene el formato esperado o contiene valores de un tipo incorrecto.",
        };
    }

    private ProblemDetails ServerErrorProblem(HttpContext httpContext, Exception exception)
    {
        logger.LogError(exception, "Unhandled exception processing {Method} {Path}", httpContext.Request.Method, httpContext.Request.Path);

        return new ProblemDetails
        {
            Status = StatusCodes.Status500InternalServerError,
            Title = "Se ha producido un error inesperado.",
        };
    }
}
