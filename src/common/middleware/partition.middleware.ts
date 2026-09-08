import { BadRequestException, Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { PartitionRequest } from '../interfaces/partition-request.interface';
import { DEFAULT_PARTITION_SLUG, PartitionService } from '../services/partition.service';

@Injectable()
export class PartitionMiddleware implements NestMiddleware {
  constructor(private readonly partitionService: PartitionService) {}

  use(request: Request, _response: Response, next: NextFunction): void {
    const header = request.header('x-app-partition');
    const path = request.originalUrl.split('?')[0].replace(/^\/api\/v1/, '');
    const requiresExplicitPartition =
      path === '/auth' ||
      path.startsWith('/auth/') ||
      path === '/organizations' ||
      path.startsWith('/organizations/') ||
      path === '/admin/cf' ||
      path.startsWith('/admin/cf/') ||
      path === '/public/form' ||
      path.startsWith('/public/form/');

    if (!header?.trim() && requiresExplicitPartition) {
      throw new BadRequestException('X-App-Partition header is required for this route.');
    }

    const slug = header?.trim() || DEFAULT_PARTITION_SLUG;

    (request as PartitionRequest).partition = this.partitionService.getPartition(slug);
    next();
  }
}