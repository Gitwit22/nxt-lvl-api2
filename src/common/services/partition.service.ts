import { BadRequestException, Injectable } from '@nestjs/common';
import fbaAppPartition from '../../config/partitions/fba-app.partition.json';
import nxtLvlSuitesPartition from '../../config/partitions/nxt-lvl-suites.partition.json';

export const DEFAULT_PARTITION_SLUG = 'fba-app';
/** Partition used by the NXT LVL Hub (suite catalog admin). */
export const SUITES_PARTITION_SLUG = 'nxt-lvl-suites';

export interface PartitionConfig {
  slug: string;
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
    [DEFAULT_PARTITION_SLUG, { slug: DEFAULT_PARTITION_SLUG, ...fbaAppPartition }],
    [SUITES_PARTITION_SLUG, { slug: SUITES_PARTITION_SLUG, ...nxtLvlSuitesPartition }],
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