import type { RouteAccessRule } from '../domain/RouteGuard';
/**
 * App-level configuration injected into auth-core.
 */
export interface AuthConfig {
    issuer: string;
    allowLogin: boolean;
    requireVerifiedEmailForLogin: boolean;
    sessionTtlSeconds: number;
    refreshTokenTtlSeconds: number;
    inviteOnlySignup: boolean;
    allowSelfServicePasswordReset: boolean;
    allowAdminInitiatedPasswordReset: boolean;
    allowSecurityQuestions: boolean;
    allowEmergencyResetCode: boolean;
    maxFailedLoginAttempts: number;
    lockoutDurationSeconds: number;
    defaultRoles: string[];
    routeDefaults: RouteAccessRule;
}
/**
 * Conservative defaults suitable for most internal apps.
 */
export declare const defaultAuthConfig: AuthConfig;
//# sourceMappingURL=AuthConfig.d.ts.map