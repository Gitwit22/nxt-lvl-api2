"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoginUseCase = void 0;
const node_crypto_1 = require("node:crypto");
const types_1 = require("../../domain/types");
/**
 * LoginUseCase coordinates the core login workflow without binding to a UI
 * framework, transport, or storage implementation.
 */
class LoginUseCase {
    constructor(dependencies) {
        this.authRepository = dependencies.authRepository;
        this.passwordHasher = dependencies.passwordHasher;
        this.tokenService = dependencies.tokenService;
        this.auditLogger = dependencies.auditLogger;
        this.config = dependencies.config;
        this.createSessionId = dependencies.createSessionId ?? (() => (0, node_crypto_1.randomUUID)());
        this.now = dependencies.now ?? (() => new Date());
    }
    async execute(credentials, context = {}) {
        if (!this.config.allowLogin) {
            return {
                success: false,
                error: (0, types_1.createAuthError)(types_1.AuthErrorCode.LOGIN_DISABLED, 'Login is currently disabled by configuration.'),
            };
        }
        const normalizedEmail = credentials.email.trim().toLowerCase();
        const account = await this.authRepository.findAccountByEmail(normalizedEmail);
        if (!account) {
            await this.auditLogger.log({
                action: 'auth.login.failed',
                actor: { email: normalizedEmail },
                occurredAt: this.now(),
                outcome: 'failure',
                context,
                details: { reason: types_1.AuthErrorCode.INVALID_CREDENTIALS },
            });
            return {
                success: false,
                error: (0, types_1.createAuthError)(types_1.AuthErrorCode.INVALID_CREDENTIALS, 'The provided credentials are invalid.'),
            };
        }
        const user = await this.authRepository.findUserById(account.userId);
        if (!user) {
            return {
                success: false,
                error: (0, types_1.createAuthError)(types_1.AuthErrorCode.USER_NOT_FOUND, 'No user record exists for this account.'),
            };
        }
        if (!user.isActive) {
            return {
                success: false,
                error: (0, types_1.createAuthError)(types_1.AuthErrorCode.ACCOUNT_INACTIVE, 'This account is inactive.'),
            };
        }
        if (account.isLocked) {
            return {
                success: false,
                error: (0, types_1.createAuthError)(types_1.AuthErrorCode.ACCOUNT_LOCKED, 'This account is locked.'),
            };
        }
        if (this.config.requireVerifiedEmailForLogin && !user.isEmailVerified) {
            return {
                success: false,
                error: (0, types_1.createAuthError)(types_1.AuthErrorCode.EMAIL_NOT_VERIFIED, 'Email verification is required before login.'),
            };
        }
        if (user.requiresPasswordReset) {
            return {
                success: false,
                error: (0, types_1.createAuthError)(types_1.AuthErrorCode.PASSWORD_RESET_REQUIRED, 'A password reset is required before login.'),
            };
        }
        const isPasswordValid = await this.passwordHasher.compare(credentials.password, account.passwordHash);
        if (!isPasswordValid) {
            const nextFailedAttempts = account.failedLoginAttempts + 1;
            await this.authRepository.updateAccount(account.id, {
                failedLoginAttempts: nextFailedAttempts,
                updatedAt: this.now(),
            });
            await this.auditLogger.log({
                action: 'auth.login.failed',
                actor: { userId: user.id, email: user.email, roles: user.roles },
                subjectUserId: user.id,
                occurredAt: this.now(),
                outcome: 'failure',
                context,
                details: {
                    reason: types_1.AuthErrorCode.INVALID_CREDENTIALS,
                    failedLoginAttempts: nextFailedAttempts,
                },
            });
            return {
                success: false,
                error: (0, types_1.createAuthError)(types_1.AuthErrorCode.INVALID_CREDENTIALS, 'The provided credentials are invalid.'),
            };
        }
        const issuedAt = this.now();
        const sessionId = this.createSessionId();
        const accessToken = await this.tokenService.sign({
            sub: user.id,
            email: user.email,
            roles: user.roles,
            sessionId,
        });
        const session = {
            sessionId,
            userId: user.id,
            accessToken,
            expiresAt: new Date(issuedAt.getTime() + this.config.sessionTtlSeconds * 1000),
            createdAt: issuedAt,
            ipAddress: context.ipAddress,
            userAgent: context.userAgent,
            metadata: context.metadata,
        };
        await this.authRepository.createSession(session);
        await this.authRepository.updateAccount(account.id, {
            failedLoginAttempts: 0,
            lastLoginAt: issuedAt,
            updatedAt: issuedAt,
        });
        await this.auditLogger.log({
            action: 'auth.login.succeeded',
            actor: { userId: user.id, email: user.email, roles: user.roles },
            subjectUserId: user.id,
            sessionId,
            occurredAt: issuedAt,
            outcome: 'success',
            context,
        });
        return {
            success: true,
            user,
            session,
        };
    }
}
exports.LoginUseCase = LoginUseCase;
//# sourceMappingURL=LoginUseCase.js.map