/**
 * auth-core/domain/types.ts
 *
 * Core domain types and interfaces for the auth-core module.
 * These are application-agnostic and must not reference any specific framework,
 * database, or product. All concrete implementations live in infrastructure/.
 */
/**
 * AuthRole represents a named role assigned to a user.
 * Extend this with a string union in your application's config if you need
 * a closed set of roles, or leave as string for open-ended role systems.
 *
 * TODO: Consider moving to a typed enum per app via AuthConfig.roles
 */
export type AuthRole = string;
/**
 * A permission is a fine-grained capability string, e.g. "posts:create".
 * Roles are mapped to permissions at the application layer.
 */
export type AuthPermission = string;
/**
 * AuthUser represents the canonical user identity within auth-core.
 * Do NOT include product-specific fields here — extend via metadata.
 */
export interface AuthUser {
    /** Unique identifier (UUID recommended) */
    id: string;
    /** Primary login email — must be unique across the system */
    email: string;
    /** Human-readable display name */
    displayName: string;
    /** Assigned roles for this user */
    roles: AuthRole[];
    /** Whether the account is active and allowed to authenticate */
    isActive: boolean;
    /** Whether the user has verified their email address */
    isEmailVerified: boolean;
    /** Whether the account requires a password reset before next login */
    requiresPasswordReset: boolean;
    /** Timestamp of account creation */
    createdAt: Date;
    /** Timestamp of last profile update */
    updatedAt: Date;
    /**
     * Arbitrary key/value metadata for app-specific extensions.
     * Do NOT store sensitive data here — use dedicated fields.
     */
    metadata?: Record<string, unknown>;
}
/**
 * AuthAccount stores authentication-specific state separate from the user
 * profile so business logic can evolve without coupling to persistence shape.
 */
export interface AuthAccount {
    /** Unique identifier for the account record */
    id: string;
    /** Foreign key to the canonical user identity */
    userId: string;
    /** Normalized login email */
    email: string;
    /** Password hash managed by the configured PasswordHasher */
    passwordHash: string;
    /** Whether the account is currently locked */
    isLocked: boolean;
    /** Count of recent failed login attempts */
    failedLoginAttempts: number;
    /** Last successful authentication timestamp */
    lastLoginAt?: Date;
    /** Optional lock expiry for timed lockouts */
    lockedUntil?: Date;
    /** Timestamp of account creation */
    createdAt: Date;
    /** Timestamp of last auth-state update */
    updatedAt: Date;
}
/**
 * Subset of AuthUser fields required to create a new account.
 */
export interface CreateUserInput {
    email: string;
    displayName: string;
    roles?: AuthRole[];
    metadata?: Record<string, unknown>;
}
/**
 * Input required to create the authentication account record.
 */
export interface CreateAccountInput {
    userId: string;
    email: string;
    passwordHash: string;
}
/**
 * AuthSession represents an active authenticated session for a user.
 * Sessions are created on successful login and destroyed on logout or expiry.
 */
export interface AuthSession {
    /** Unique session identifier */
    sessionId: string;
    /** The authenticated user's ID */
    userId: string;
    /** Signed access token (e.g. JWT) */
    accessToken: string;
    /** Optional refresh token for silent token renewal */
    refreshToken?: string;
    /** When the access token expires */
    expiresAt: Date;
    /** When the session was created */
    createdAt: Date;
    /** IP address of the client that created the session (optional) */
    ipAddress?: string;
    /** User-agent string of the client (optional) */
    userAgent?: string;
    /** Optional session metadata for adapters or downstream consumers */
    metadata?: Record<string, unknown>;
}
/**
 * Credentials submitted by a user attempting to log in.
 */
export interface LoginCredentials {
    email: string;
    password: string;
}
/**
 * Context captured during a login attempt.
 */
export interface LoginContext {
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, unknown>;
}
/**
 * The result returned by the login use case.
 * Use the discriminated union to branch cleanly on success/failure.
 */
export type LoginResult = {
    success: true;
    user: AuthUser;
    session: AuthSession;
} | {
    success: false;
    error: AuthError;
};
/**
 * A pending password reset request. Created by an admin or triggered by
 * the user via "forgot password". The token is sent out-of-band (email, SMS).
 */
export interface PasswordResetRequest {
    id: string;
    userId: string;
    /** Hashed reset token — store hashed, send plain to user */
    tokenHash: string;
    expiresAt: Date;
    createdAt: Date;
    /** Whether this reset was admin-initiated vs. self-service */
    adminInitiated: boolean;
    /** Consumed means it has already been used */
    consumedAt?: Date;
}
/**
 * A security question/answer pair stored for a user.
 * Answers must be stored hashed.
 *
 * TODO: Implement in a future auth-core iteration.
 */
export interface SecurityQuestion {
    id: string;
    userId: string;
    /** The displayed question text */
    question: string;
    /** Hashed answer — never store plain text */
    answerHash: string;
    createdAt: Date;
}
/**
 * A one-time emergency reset code. Used when normal reset channels are
 * unavailable (e.g. lost email access).
 *
 * TODO: Implement in a future auth-core iteration.
 */
export interface EmergencyResetCode {
    id: string;
    userId: string;
    /** Hashed code — deliver plain to user at setup, store hashed */
    codeHash: string;
    createdAt: Date;
    usedAt?: Date;
}
/**
 * An invite token granting a new user the right to create an account.
 * Detailed invite logic belongs in invite-core; this type is the auth-core
 * contract for validating invite tokens at signup.
 *
 * TODO: Full implementation in invite-core.
 */
export interface InviteTokenRef {
    /** The raw invite token to validate */
    token: string;
    /** Email the invite was issued to — must match signup email */
    email: string;
}
/**
 * Canonical error codes for auth-related failures.
 * Add new codes here as features are implemented — never use raw strings.
 */
export declare enum AuthErrorCode {
    INVALID_CREDENTIALS = "AUTH_INVALID_CREDENTIALS",
    ACCOUNT_INACTIVE = "AUTH_ACCOUNT_INACTIVE",
    ACCOUNT_LOCKED = "AUTH_ACCOUNT_LOCKED",
    LOGIN_DISABLED = "AUTH_LOGIN_DISABLED",
    EMAIL_NOT_VERIFIED = "AUTH_EMAIL_NOT_VERIFIED",
    PASSWORD_RESET_REQUIRED = "AUTH_PASSWORD_RESET_REQUIRED",
    INVITE_REQUIRED = "AUTH_INVITE_REQUIRED",
    INVITE_INVALID = "AUTH_INVITE_INVALID",
    SESSION_EXPIRED = "AUTH_SESSION_EXPIRED",
    SESSION_NOT_FOUND = "AUTH_SESSION_NOT_FOUND",
    TOKEN_INVALID = "AUTH_TOKEN_INVALID",
    RESET_TOKEN_INVALID = "AUTH_RESET_TOKEN_INVALID",
    RESET_TOKEN_EXPIRED = "AUTH_RESET_TOKEN_EXPIRED",
    USER_NOT_FOUND = "AUTH_USER_NOT_FOUND",
    USER_ALREADY_EXISTS = "AUTH_USER_ALREADY_EXISTS",
    UNAUTHORIZED = "AUTH_UNAUTHORIZED",
    FORBIDDEN = "AUTH_FORBIDDEN",
    UNKNOWN = "AUTH_UNKNOWN"
}
/**
 * A structured error returned by auth-core use cases and services.
 * Use this instead of throwing raw Error objects at the application boundary.
 */
export interface AuthError {
    code: AuthErrorCode;
    message: string;
    /** Optional diagnostics for logging — never expose to end users */
    details?: unknown;
}
/**
 * Helper to construct a typed AuthError.
 */
export declare function createAuthError(code: AuthErrorCode, message: string, details?: unknown): AuthError;
//# sourceMappingURL=types.d.ts.map