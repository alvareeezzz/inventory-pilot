import { HttpErrorResponse } from '@angular/common/http';
import { describeHttpError, getProblemDetails } from './problem-details';

describe('problem-details', () => {
  it('extrae el ProblemDetails del cuerpo de un error HTTP', () => {
    const error = new HttpErrorResponse({ status: 409, error: { title: 'SKU duplicado', status: 409 } });

    expect(getProblemDetails(error)).toEqual({ title: 'SKU duplicado', status: 409 });
  });

  it('devuelve null si el error no es HTTP o no trae cuerpo', () => {
    expect(getProblemDetails(new Error('x'))).toBeNull();
    expect(getProblemDetails(new HttpErrorResponse({ status: 500, error: null }))).toBeNull();
  });

  it('prioriza detail sobre title al describir el error', () => {
    const error = new HttpErrorResponse({ status: 409, error: { title: 'SKU duplicado', detail: 'Ya existe ELEC-1.' } });

    expect(describeHttpError(error)).toBe('Ya existe ELEC-1.');
  });

  it('explica cuando no hay conexión con la API', () => {
    expect(describeHttpError(new HttpErrorResponse({ status: 0 }))).toContain('No se puede conectar');
  });

  it('usa un mensaje genérico para errores sin ProblemDetails', () => {
    expect(describeHttpError(new HttpErrorResponse({ status: 502, error: 'Bad gateway' }))).toBe(
      'Error del servidor (502).',
    );
    expect(describeHttpError('boom')).toBe('Se ha producido un error inesperado.');
  });
});
