import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { DataSource } from 'typeorm';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Health')
@Public()
@SkipThrottle({ default: true, strict: true })
@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  @ApiOperation({ summary: 'Liveness/readiness probe (checks PostgreSQL and PostGIS)' })
  async check() {
    const started = Date.now();
    try {
      await this.dataSource.query('SELECT 1');
    } catch {
      throw new ServiceUnavailableException({ message: 'Database unreachable' });
    }
    let postgis: string | null;
    try {
      const rows = (await this.dataSource.query('SELECT PostGIS_Version() AS v')) as Array<{
        v: string;
      }>;
      postgis = rows[0]?.v?.split(' ')[0] ?? null;
    } catch {
      postgis = null;
    }
    return {
      status: postgis ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      database: { status: 'up', latencyMs: Date.now() - started, postgis },
    };
  }
}
