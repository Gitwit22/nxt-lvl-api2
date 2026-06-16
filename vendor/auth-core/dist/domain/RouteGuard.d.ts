import type { AuthPermission, AuthRole, AuthUser } from './types';
/**
 * Rules used by hosting apps to declare access expectations for a route.
 */
export interface RouteAccessRule {
    requireAuthenticated?: boolean;
    requireVerifiedEmail?: boolean;
    allowRoles?: AuthRole[];
    denyRoles?: AuthRole[];
    requirePermissions?: AuthPermission[];
    requireAllPermissions?: boolean;
}
/**
 * Context available when evaluating access for a route or view.
 */
export interface RouteAccessContext {
    user?: AuthUser;
    userPermissions?: AuthPermission[];
    routeId?: string;
}
/**
 * Result of a route access check.
 */
export interface RouteAccessDecision {
    allowed: boolean;
    reason?: string;
}
/**
 * RouteGuard evaluates whether a user can access a route under a given rule.
 */
export interface RouteGuard {
    evaluate(rule: RouteAccessRule, context: RouteAccessContext): RouteAccessDecision;
}
//# sourceMappingURL=RouteGuard.d.ts.map