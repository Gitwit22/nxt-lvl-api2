import type { Request } from 'express';
import type { PartitionConfig } from '../services/partition.service';

export interface PartitionRequest extends Request {
  partition: PartitionConfig;
}