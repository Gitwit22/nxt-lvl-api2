import { BadRequestException, Injectable } from '@nestjs/common';
import clientflowPartition from '../../config/partitions/clientflow.partition.json';
import fbaAppPartition from '../../config/partitions/fba-app.partition.json';

export const DEFAULT_PARTITION_SLUG = 'fba-app';

export interface PartitionConfig {
  customerName: string;
  organizationSlug: string;
  organizationName: string;
  primaryProgramSlug: string;
  primaryProgramName: string;
  authIssuer: string;
  appName: string;
  appUrl: string;
  storageNamespace: string;
}

@Injectable()
export class PartitionService {
  private readonly partitions = new Map<string, PartitionConfig>([
    [DEFAULT_PARTITION_SLUG, fbaAppPartition],
    ['clientflow', clientflowPartition],
  ]);

  getPartition(slug: string): PartitionConfig {
    const partition = this.partitions.get(slug.trim().toLowerCase());

    if (!partition) {
      throw new BadRequestException(`Unknown app partition: ${slug}`);
    }

    return partition;
  }

  getDefaultPartition(): PartitionConfig {
    return this.getPartition(DEFAULT_PARTITION_SLUG);
  }

  getPartitions(): readonly PartitionConfig[] {
    return [...this.partitions.values()];
  }
}