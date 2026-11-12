import { registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es';
import { DEFAULT_CURRENCY_CODE, EnvironmentProviders, LOCALE_ID, makeEnvironmentProviders } from '@angular/core';

/** Formatos en español de España: números, fechas y moneda en euros. */
export function provideSpanishLocale(): EnvironmentProviders {
  registerLocaleData(localeEs);
  return makeEnvironmentProviders([
    { provide: LOCALE_ID, useValue: 'es' },
    { provide: DEFAULT_CURRENCY_CODE, useValue: 'EUR' },
  ]);
}
