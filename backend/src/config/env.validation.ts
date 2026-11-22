import { isIP } from 'node:net';
import type { NodeEnvironment } from './configuration';

const DEFAULT_CORS_ORIGIN = 'http://localhost:5173';

function parseNodeEnvironment(value: unknown): NodeEnvironment {
  const environment = value === undefined ? 'development' : value;
  if (environment === 'development' || environment === 'test' || environment === 'production') {
    return environment;
  }
  throw new Error('NODE_ENV must be development, test, or production.');
}

function parseHost(value: unknown): string {
  const host = value === undefined ? '127.0.0.1' : value;
  if (typeof host === 'string' && (host === 'localhost' || isIP(host) !== 0)) {
    return host;
  }
  throw new Error('HOST must be localhost or a valid IP address. Use 0.0.0.0 only when public binding is intended.');
}

function parsePort(value: unknown): number {
  const raw = value === undefined ? '4000' : value;
  if (typeof raw !== 'string' || !/^[1-9][0-9]{0,4}$/.test(raw)) {
    throw new Error('PORT must be an integer from 1 to 65535.');
  }
  const port = Number(raw);
  if (port > 65535) throw new Error('PORT must be an integer from 1 to 65535.');
  return port;
}

function parseCorsOrigins(value: unknown, environment: NodeEnvironment): string[] {
  if (value === undefined && environment === 'production') {
    throw new Error('CORS_ORIGINS must be set explicitly in production.');
  }
  const raw = value === undefined ? DEFAULT_CORS_ORIGIN : value;
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new Error('CORS_ORIGINS must contain at least one HTTP or HTTPS origin.');
  }

  const origins = raw.split(',').map((origin) => origin.trim());
  for (const origin of origins) {
    if (!origin || origin.includes('*')) {
      throw new Error('CORS_ORIGINS must contain explicit origins without wildcards.');
    }
    let parsed: URL;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error('CORS_ORIGINS contains a malformed origin.');
    }
    if (
      !['http:', 'https:'].includes(parsed.protocol) ||
      parsed.username ||
      parsed.password ||
      parsed.origin !== origin
    ) {
      throw new Error('CORS_ORIGINS must contain only canonical HTTP or HTTPS origins, without paths or credentials.');
    }
  }
  return [...new Set(origins)];
}

export function validateEnvironment(input: Record<string, unknown>): Record<string, unknown> {
  const environment = parseNodeEnvironment(input.NODE_ENV);
  const databaseUrl = input.DATABASE_URL;
  if (typeof databaseUrl !== 'string' || !/^postgres(ql)?:\/\//.test(databaseUrl)) {
    throw new Error('DATABASE_URL must be a PostgreSQL connection URL.');
  }
  const issuer = input.SUPABASE_ISSUER;
  const audience = input.SUPABASE_AUDIENCE;
  const jwksUrl = input.SUPABASE_JWKS_URL;
  if (typeof issuer !== 'string' || typeof audience !== 'string' || typeof jwksUrl !== 'string' || !audience.trim()) {
    throw new Error('Supabase issuer, audience, and JWKS URL are required.');
  }
  let issuerParsed: URL;
  let jwksParsed: URL;
  try { issuerParsed = new URL(issuer); jwksParsed = new URL(jwksUrl); }
  catch { throw new Error('Supabase URLs must be valid.'); }
  const local = issuerParsed.hostname === '127.0.0.1' || issuerParsed.hostname === 'localhost';
  if ((issuerParsed.protocol !== 'https:' && !(local && environment !== 'production' && issuerParsed.protocol === 'http:')) ||
      issuerParsed.pathname !== '/auth/v1' || issuerParsed.search || issuerParsed.hash ||
      jwksParsed.origin !== issuerParsed.origin || jwksParsed.pathname !== '/auth/v1/.well-known/jwks.json' ||
      jwksParsed.search || jwksParsed.hash) {
    throw new Error('Supabase issuer and JWKS URL must refer to the same trusted Auth server.');
  }
  return {
    ...input,
    NODE_ENV: environment,
    HOST: parseHost(input.HOST),
    PORT: parsePort(input.PORT),
    CORS_ORIGINS: parseCorsOrigins(input.CORS_ORIGINS, environment),
  };
}
