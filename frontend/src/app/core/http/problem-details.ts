import { HttpErrorResponse } from '@angular/common/http';

/** Formato de error que devuelve la API (RFC 9457). */
export interface ProblemDetails {
  title?: string;
  detail?: string;
  status?: number;
  errors?: Record<string, string[]>;
}

export function getProblemDetails(error: unknown): ProblemDetails | null {
  if (error instanceof HttpErrorResponse && error.error && typeof error.error === 'object') {
    return error.error as ProblemDetails;
  }
  return null;
}

/** Mensaje legible para el usuario a partir de un error HTTP. */
export function describeHttpError(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) {
    return 'Se ha producido un error inesperado.';
  }
  if (error.status === 0) {
    return 'No se puede conectar con el servidor. Comprueba que la API está arrancada.';
  }
  const problem = getProblemDetails(error);
  return problem?.detail ?? problem?.title ?? `Error del servidor (${error.status}).`;
}
