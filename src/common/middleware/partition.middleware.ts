import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { PartitionRequest } from '../interfaces/partition-request.interface';
import { DEFAULT_PARTITION_SLUG, PartitionService } from '../services/partition.service';

@Injectable()
export class PartitionMiddleware implements NestMiddleware {
  constructor(private readonly partitionService: PartitionService) {}

  use(request: Request, _response: Response, next: NextFunction): void {
    const header = request.header('x-app-partition');
    const slug = header?.trim() || DEFAULT_PARTITION_SLUG;

    (request as PartitionRequest).partition = this.partitionService.getPartition(slug);
    next();
  }
}