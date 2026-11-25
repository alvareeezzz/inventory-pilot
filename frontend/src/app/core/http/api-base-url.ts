import { InjectionToken } from '@angular/core';
import { environment } from '../../../environments/environment';

/**
 * URL base de la API. Viene de los archivos de entorno (src/environments) y se expone
 * como token para poder sustituirla en los tests.
 */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  factory: () => environment.apiUrl,
});
