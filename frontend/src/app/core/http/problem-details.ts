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
  const message = problem?.detail ?? problem?.title;
  if (message) {
    return message;
  }
  // Sin ProblemDetails legible: un 4xx es un problema de la petición, no un fallo del servidor.
  if (error.status === 400) {
    return 'La petición no es válida.';
  }
  if (error.status < 500) {
    return `No se ha podido completar la petición (${error.status}).`;
  }
  return `Error del servidor (${error.status}).`;
}
