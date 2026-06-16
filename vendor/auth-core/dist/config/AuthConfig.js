"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultAuthConfig = void 0;
/**
 * Conservative defaults suitable for most internal apps.
 */
exports.defaultAuthConfig = {
    issuer: 'nxtlvl-auth-core',
    allowLogin: true,
    requireVerifiedEmailForLogin: false,
    sessionTtlSeconds: 60 * 60,
    refreshTokenTtlSeconds: 60 * 60 * 24 * 14,
    inviteOnlySignup: true,
    allowSelfServicePasswordReset: true,
    allowAdminInitiatedPasswordReset: true,
    allowSecurityQuestions: false,
    allowEmergencyResetCode: false,
    maxFailedLoginAttempts: 5,
    lockoutDurationSeconds: 60 * 15,
    defaultRoles: [],
    routeDefaults: {
        requireAuthenticated: true,
    },
};
//# sourceMappingURL=AuthConfig.js.map