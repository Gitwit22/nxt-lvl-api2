import { Injectable, Logger } from '@nestjs/common';
import type { AuditLogger, AuthAuditEvent } from '@nxtlvl/auth-core';

@Injectable()
export class ConsoleAuditLogger implements AuditLogger {
  private readonly logger = new Logger('AuthAudit');

  async log(event: AuthAuditEvent): Promise<void> {
    const msg = `${event.action} | ${event.actor?.email ?? 'unknown'} | ${event.outcome}`;
    if (event.outcome === 'success') {
      this.logger.log(msg);
    } else {
      this.logger.warn(msg);
    }
  }
}
