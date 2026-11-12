import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { API_BASE_URL } from './api-base-url';

describe('API_BASE_URL', () => {
  it('toma por defecto la URL del entorno', () => {
    expect(TestBed.inject(API_BASE_URL)).toBe(environment.apiUrl);
  });

  it('se puede sustituir (por ejemplo, en tests)', () => {
    TestBed.configureTestingModule({ providers: [{ provide: API_BASE_URL, useValue: 'https://api.test' }] });

    expect(TestBed.inject(API_BASE_URL)).toBe('https://api.test');
  });
});
