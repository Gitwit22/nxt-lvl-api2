"use strict";
/**
 * auth-core/domain/types.ts
 *
 * Core domain types and interfaces for the auth-core module.
 * These are application-agnostic and must not reference any specific framework,
 * database, or product. All concrete implementations live in infrastructure/.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthErrorCode = void 0;
exports.createAuthError = createAuthError;
// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------
/**
 * Canonical error codes for auth-related failures.
 * Add new codes here as features are implemented — never use raw strings.
 */
var AuthErrorCode;
(function (AuthErrorCode) {
    AuthErrorCode["INVALID_CREDENTIALS"] = "AUTH_INVALID_CREDENTIALS";
    AuthErrorCode["ACCOUNT_INACTIVE"] = "AUTH_ACCOUNT_INACTIVE";
    AuthErrorCode["ACCOUNT_LOCKED"] = "AUTH_ACCOUNT_LOCKED";
    AuthErrorCode["LOGIN_DISABLED"] = "AUTH_LOGIN_DISABLED";
    AuthErrorCode["EMAIL_NOT_VERIFIED"] = "AUTH_EMAIL_NOT_VERIFIED";
    AuthErrorCode["PASSWORD_RESET_REQUIRED"] = "AUTH_PASSWORD_RESET_REQUIRED";
    AuthErrorCode["INVITE_REQUIRED"] = "AUTH_INVITE_REQUIRED";
    AuthErrorCode["INVITE_INVALID"] = "AUTH_INVITE_INVALID";
    AuthErrorCode["SESSION_EXPIRED"] = "AUTH_SESSION_EXPIRED";
    AuthErrorCode["SESSION_NOT_FOUND"] = "AUTH_SESSION_NOT_FOUND";
    AuthErrorCode["TOKEN_INVALID"] = "AUTH_TOKEN_INVALID";
    AuthErrorCode["RESET_TOKEN_INVALID"] = "AUTH_RESET_TOKEN_INVALID";
    AuthErrorCode["RESET_TOKEN_EXPIRED"] = "AUTH_RESET_TOKEN_EXPIRED";
    AuthErrorCode["USER_NOT_FOUND"] = "AUTH_USER_NOT_FOUND";
    AuthErrorCode["USER_ALREADY_EXISTS"] = "AUTH_USER_ALREADY_EXISTS";
    AuthErrorCode["UNAUTHORIZED"] = "AUTH_UNAUTHORIZED";
    AuthErrorCode["FORBIDDEN"] = "AUTH_FORBIDDEN";
    AuthErrorCode["UNKNOWN"] = "AUTH_UNKNOWN";
})(AuthErrorCode || (exports.AuthErrorCode = AuthErrorCode = {}));
/**
 * Helper to construct a typed AuthError.
 */
function createAuthError(code, message, details) {
    return { code, message, details };
}
//# sourceMappingURL=types.js.map