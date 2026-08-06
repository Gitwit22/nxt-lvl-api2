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

  async updateOrganizationSettings(organizationId: string, settings: Record<string, any>) {
    const organization = await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        settings: {
          ...((organization.settings || {}) as Record<string, any>),
          ...settings,
        },
      },
    });

    return {
      id: organization.id,
      name: organization.name,
      settings: organization.settings,
    };
  }

  async listAdminUsers(organizationId: string) {
    // Verify organization exists
    await this.getOrganization(organizationId);

    return this.prisma.adminUser.findMany({
      where: { organizationId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAdminUser(organizationId: string, adminId: string) {
    const admin = await this.prisma.adminUser.findFirst({
      where: {
        id: adminId,
        organizationId,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    if (!admin) {
      throw new NotFoundException('Admin user not found in this organization');
    }

    return admin;
  }
}
