import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AppConfig } from '../../config';
import { AuthService } from './auth.service';

@Injectable()
export class TokenCleanupTask {
  private readonly logger = new Logger(TokenCleanupTask.name);
  private readonly enabled: boolean;

  constructor(
    private readonly auth: AuthService,
    config: ConfigService<AppConfig, true>,
  ) {
    this.enabled = config.get('scheduler', { infer: true }).enabled;
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgeExpiredRefreshTokens(): Promise<void> {
    if (!this.enabled) return;
    const removed = await this.auth.purgeExpiredTokens();
    if (removed > 0) this.logger.log(`Purged ${removed} expired refresh token(s)`);
  }
}
