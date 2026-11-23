import { ConfigService } from '@nestjs/config';

export const API_PREFIX = 'v1';
export const SERVICE_NAME = 'kaamdham-api';

export type NodeEnvironment = 'development' | 'test' | 'production';

export interface AppConfiguration {
  nodeEnv: NodeEnvironment;
  host: string;
  port: number;
  corsOrigins: string[];
  rateLimitPerMinute: number;
  rateLimitWritePerMinute: number;
  trustProxyHops: number;
}

export function getAppConfiguration(config: ConfigService): AppConfiguration {
  return {
    nodeEnv: config.getOrThrow<NodeEnvironment>('NODE_ENV'),
    host: config.getOrThrow<string>('HOST'),
    port: config.getOrThrow<number>('PORT'),
    corsOrigins: config.getOrThrow<string[]>('CORS_ORIGINS'),
    rateLimitPerMinute: config.getOrThrow<number>('RATE_LIMIT_PER_MINUTE'),
    rateLimitWritePerMinute: config.getOrThrow<number>('RATE_LIMIT_WRITE_PER_MINUTE'),
    trustProxyHops: config.getOrThrow<number>('TRUST_PROXY_HOPS'),
  };
}
