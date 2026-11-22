import { Controller, Get } from '@nestjs/common';
import { SERVICE_NAME } from '../config/configuration';

export interface HealthResponse {
  status: 'ok';
  service: typeof SERVICE_NAME;
}

@Controller('health')
export class HealthController {
  @Get()
  getHealth(): HealthResponse {
    return { status: 'ok', service: SERVICE_NAME };
  }
}
