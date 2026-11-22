import { Controller, Get, HttpCode, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../database/prisma.service';

@ApiTags('Health')
@Controller('ready')
export class ReadyController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @HttpCode(200)
  @ApiOperation({ summary: 'Database readiness' })
  @ApiResponse({ status: 200, description: 'Database connected' })
  @ApiResponse({ status: 503, description: 'Database disconnected' })
  async ready(): Promise<{ status: string; database: string }> {
    if (!(await this.prisma.isReady())) {
      throw new ServiceUnavailableException({ status: 'not_ready', database: 'disconnected' });
    }
    return { status: 'ready', database: 'connected' };
  }
}
