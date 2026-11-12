import { InjectionToken } from '@angular/core';

/**
 * URL base de la API. En desarrollo es relativa ("/api") y el servidor de Angular
 * la redirige a la API .NET mediante proxy.conf.json.
 */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  factory: () => '/api',
});
