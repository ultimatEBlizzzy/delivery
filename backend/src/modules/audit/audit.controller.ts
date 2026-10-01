import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@hardware-delivery/shared';
import { Auth } from '../../common/decorators/roles.decorator';
import { AuditService } from './audit.service';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';

@ApiTags('Admin · Audit log')
@Auth(Role.ADMIN)
@Controller('admin/audit-logs')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'Browse the audit trail of important actions' })
  list(@Query() query: AuditLogQueryDto) {
    return this.audit.list(query);
  }
}
