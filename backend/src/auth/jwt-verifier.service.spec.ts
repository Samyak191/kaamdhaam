import { createServer, type Server } from 'node:http';
import { exportJWK, generateKeyPair, SignJWT, type KeyLike } from 'jose';
import { ConfigService } from '@nestjs/config';
import { JwtVerifierService } from './jwt-verifier.service';

describe('Supabase JWT verification', () => {
  jest.setTimeout(30000);
  const subject = '6ce06c2d-1678-4d43-84bc-74cb587ab2cf';
  let server: Server;
  let privateKey: KeyLike;
  let verifier: JwtVerifierService;
  let issuer: string;

  beforeAll(async () => {
    const keys = await generateKeyPair('RS256');
    privateKey = keys.privateKey;
    const jwk = await exportJWK(keys.publicKey);
    jwk.kid = 'test-key';
    jwk.alg = 'RS256';
    server = createServer((_request, response) => {
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ keys: [jwk] }));
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('No test server address');
    issuer = `http://127.0.0.1:${address.port}/auth/v1`;
    const config = { getOrThrow: (name: string) => ({
      SUPABASE_ISSUER: issuer,
      SUPABASE_AUDIENCE: 'authenticated',
      SUPABASE_JWKS_URL: `${issuer}/.well-known/jwks.json`,
    })[name] } as ConfigService;
    verifier = new JwtVerifierService(config);
  }, 30000);
  afterAll(async () => { if (server) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); });

  const sign = (claims: Record<string, unknown> = {}, options: { issuer?: string; audience?: string; alg?: string } = {}) =>
    new SignJWT({ role: 'authenticated', ...claims })
      .setProtectedHeader({ alg: options.alg || 'RS256', kid: 'test-key' })
      .setIssuer(options.issuer || issuer)
      .setAudience(options.audience || 'authenticated')
      .setSubject(subject)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(privateKey);

  it('accepts a signed access token with trusted claims', async () => {
    await expect(verifier.verify(await sign())).resolves.toBe(subject);
  });
  it('rejects wrong issuer and audience', async () => {
    await expect(verifier.verify(await sign({}, { issuer: 'https://evil.example/auth/v1' }))).rejects.toThrow();
    await expect(verifier.verify(await sign({}, { audience: 'other' }))).rejects.toThrow();
  });
  it('rejects expired and future not-before tokens', async () => {
    const expired = await new SignJWT({ role: 'authenticated' }).setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setIssuer(issuer).setAudience('authenticated').setSubject(subject).setIssuedAt(1).setExpirationTime(2).sign(privateKey);
    await expect(verifier.verify(expired)).rejects.toThrow();
    await expect(verifier.verify(await sign({ nbf: Math.floor(Date.now() / 1000) + 600 }))).rejects.toThrow();
  });
  it('rejects a forged signature and missing trusted role', async () => {
    const forged = await generateKeyPair('RS256');
    const token = await new SignJWT({ role: 'authenticated' }).setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setIssuer(issuer).setAudience('authenticated').setSubject(subject).setIssuedAt().setExpirationTime('5m').sign(forged.privateKey);
    await expect(verifier.verify(token)).rejects.toThrow();
    await expect(verifier.verify(await sign({ role: 'anon' }))).rejects.toThrow();
  });
  it('rejects a token without subject', async () => {
    const token = await new SignJWT({ role: 'authenticated' }).setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setIssuer(issuer).setAudience('authenticated').setIssuedAt().setExpirationTime('5m').sign(privateKey);
    await expect(verifier.verify(token)).rejects.toThrow();
  });
  it('rejects a correctly formed HS256 token', async () => {
    const token = await new SignJWT({ role: 'authenticated' }).setProtectedHeader({ alg: 'HS256' })
      .setIssuer(issuer).setAudience('authenticated').setSubject(subject).setIssuedAt().setExpirationTime('5m')
      .sign(Buffer.alloc(32, 1));
    await expect(verifier.verify(token)).rejects.toThrow();
  });
});
