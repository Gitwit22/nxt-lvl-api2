/**
 * Platform-level roles - system-wide permissions
 * A platform_super_admin can access multiple organizations
 */
export enum PlatformRole {
  PLATFORM_SUPER_ADMIN = 'platform_super_admin',
}

/**
 * Organization-level roles - organization-scoped permissions
 */
export enum OrganizationRole {
  ORG_OWNER = 'org_owner',
  ORG_ADMIN = 'org_admin',
  REVIEWER = 'reviewer',
}

export type UserRole = PlatformRole | OrganizationRole;

/**
 * Permission levels
 * - PLATFORM: Can access system-wide functions
 * - ORG_OWNER: Can control only their own organization
 * - ORG_ADMIN: Can manage organization users and resources
 * - REVIEWER: Can view and provide feedback only
 */
export const RoleHierarchy: Record<UserRole, number> = {
  [PlatformRole.PLATFORM_SUPER_ADMIN]: 4,
  [OrganizationRole.ORG_OWNER]: 3,
  [OrganizationRole.ORG_ADMIN]: 2,
  [OrganizationRole.REVIEWER]: 1,
};

export const isPlatformAdmin = (platformRole?: PlatformRole): boolean => {
  return platformRole === PlatformRole.PLATFORM_SUPER_ADMIN;
};

export const isOrgOwner = (orgRole?: OrganizationRole): boolean => {
  return orgRole === OrganizationRole.ORG_OWNER;
};

export const isOrgAdmin = (orgRole?: OrganizationRole): boolean => {
  return (
    orgRole === OrganizationRole.ORG_ADMIN ||
    orgRole === OrganizationRole.ORG_OWNER
  );
};

export const canManageOrganizationUsers = (
  platformRole?: PlatformRole,
  orgRole?: OrganizationRole,
): boolean => {
  return (
    isPlatformAdmin(platformRole) ||
    isOrgAdmin(orgRole)
  );
};

export const canAccessOrganization = (
  platformRole?: PlatformRole,
  orgRole?: OrganizationRole,
): boolean => {
  return Boolean(platformRole || orgRole);
};
