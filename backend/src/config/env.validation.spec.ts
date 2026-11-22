import { validateEnvironment } from './env.validation';

describe('environment validation', () => {
  const valid = (values: Record<string, unknown> = {}) => validateEnvironment({
    DATABASE_URL: 'postgresql://test:placeholder@127.0.0.1:5433/kaamdham_test',
    SUPABASE_ISSUER: 'https://example.supabase.co/auth/v1',
    SUPABASE_AUDIENCE: 'authenticated',
    SUPABASE_JWKS_URL: 'https://example.supabase.co/auth/v1/.well-known/jwks.json',
    ...values,
  });
  it('uses local-only development defaults', () => {
    expect(valid()).toMatchObject({
      NODE_ENV: 'development',
      HOST: '127.0.0.1',
      PORT: 4000,
      CORS_ORIGINS: ['http://localhost:5173'],
    });
  });

  it.each(['0', '65536', '4000.5', 'abc', ''])('rejects invalid port %s', (port) => {
    expect(() => valid({ PORT: port })).toThrow('PORT');
  });

  it('rejects a malformed or non-origin CORS value', () => {
    expect(() => valid({ CORS_ORIGINS: 'not-a-url' })).toThrow('CORS_ORIGINS');
    expect(() => valid({ CORS_ORIGINS: 'http://localhost:5173/path' })).toThrow('CORS_ORIGINS');
  });

  it('accepts multiple explicit origins and removes duplicates', () => {
    expect(valid({ CORS_ORIGINS: 'http://localhost:5173, https://app.example.com,http://localhost:5173' }).CORS_ORIGINS)
      .toEqual(['http://localhost:5173', 'https://app.example.com']);
  });

  it('rejects wildcard origins', () => {
    expect(() => valid({ CORS_ORIGINS: '*' })).toThrow('wildcards');
    expect(() => valid({ CORS_ORIGINS: 'https://*.example.com' })).toThrow('wildcards');
  });

  it('requires an explicit CORS allowlist in production', () => {
    expect(() => valid({ NODE_ENV: 'production' })).toThrow('CORS_ORIGINS');
  });

  it('rejects invalid environment and host values', () => {
    expect(() => valid({ NODE_ENV: 'preview' })).toThrow('NODE_ENV');
    expect(() => valid({ HOST: 'example.com' })).toThrow('HOST');
  });
});
