import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

@Injectable()
export class JwtVerifierService {
  private readonly issuer: string;
  private readonly audience: string;
  private readonly keys: JWTVerifyGetKey;

  constructor(config: ConfigService) {
    this.issuer = config.getOrThrow<string>('SUPABASE_ISSUER');
    this.audience = config.getOrThrow<string>('SUPABASE_AUDIENCE');
    this.keys = createRemoteJWKSet(new URL(config.getOrThrow<string>('SUPABASE_JWKS_URL')), {
      timeoutDuration: 3000,
      cooldownDuration: 30000,
      cacheMaxAge: 600000,
    });
  }

  async verify(token: string): Promise<string> {
    try {
      const { payload } = await jwtVerify(token, this.keys, {
        issuer: this.issuer,
        audience: this.audience,
        algorithms: ['RS256', 'ES256'],
        clockTolerance: 5,
        requiredClaims: ['sub', 'exp', 'iat'],
      });
      if (payload.role !== 'authenticated' || typeof payload.sub !== 'string' ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payload.sub)) {
        throw new Error('Invalid access-token claims');
      }
      return payload.sub;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }
}
