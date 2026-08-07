import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrganization(organizationId: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        programs: {
          where: { status: 'active' },
          select: {
            id: true,
            name: true,
            slug: true,
            type: true,
          },
        },
      },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    return organization;
  }

  async getOrganizationSettings(organizationId: string) {
    const organization = await this.getOrganization(organizationId);
    return {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      status: organization.status,
      settings: organization.settings || {},
      programs: organization.programs,
    };
  }

  async updateOrganizationSettings(organizationId: string, settings: Record<string, unknown>) {
    const existing = await this.getOrganization(organizationId);
    const merged = {
      ...((existing.settings ?? {}) as Record<string, unknown>),
      ...settings,
    };
    const updated = await this.prisma.organization.update({
      where: { id: organizationId },
      data: { settings: merged as Parameters<typeof this.prisma.organization.update>[0]['data']['settings'] },
    });
    return { id: updated.id, name: updated.name, settings: updated.settings };
  }
}
