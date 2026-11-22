import 'dotenv/config';
process.env.DATABASE_URL ??= 'postgresql://test:placeholder@127.0.0.1:5433/kaamdham_test?schema=public';
process.env.SUPABASE_ISSUER ??= 'https://example.supabase.co/auth/v1';
process.env.SUPABASE_AUDIENCE ??= 'authenticated';
process.env.SUPABASE_JWKS_URL ??= 'https://example.supabase.co/auth/v1/.well-known/jwks.json';
