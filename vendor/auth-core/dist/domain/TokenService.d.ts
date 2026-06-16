/**
 * auth-core/domain/TokenService.ts
 *
 * Interface for signing, verifying, refreshing, and revoking auth tokens.
 * Concrete implementations (JWT via jose/jsonwebtoken, opaque tokens, etc.)
 * live in infrastructure/ and are injected at runtime.
 */
import type { AuthRole } from './types';
/**
 * The claims embedded within a signed access token.
 * Keep this minimal — tokens are sent on every request.
 */
export interface TokenPayload {
    /** Subject — the authenticated user's ID */
    sub: string;
    /** Email included for quick identity checks without a DB lookup */
    email: string;
    /** Roles at the time of token issuance */
    roles: AuthRole[];
    /** Issued-at timestamp (Unix seconds) */
    iat: number;
    /** Expiry timestamp (Unix seconds) */
    exp: number;
    /** Unique token ID — used for revocation */
    jti: string;
    /** Optional session reference */
    sessionId?: string;
}
/**
 * Input required to sign a new token.
 */
export interface SignTokenInput {
    sub: string;
    email: string;
    roles: AuthRole[];
    sessionId?: string;
}
/**
 * TokenService handles all lifecycle operations for access and refresh tokens.
 *
 * TODO: Provide a JwtTokenService implementation in infrastructure/tokens/
 */
export interface TokenService {
    /**
     * Sign a new access token for the given claims.
     * @returns A signed token string ready to send to the client.
     */
    sign(input: SignTokenInput): Promise<string>;
    /**
     * Verify and decode a token string.
     * @throws An error (mapped to AuthErrorCode.TOKEN_INVALID) if invalid or expired.
     */
    verify(token: string): Promise<TokenPayload>;
    /**
     * Issue a new access token using a valid refresh token.
     * @returns A new signed access token string.
     * @throws If the refresh token is invalid, expired, or revoked.
     *
     * TODO: Implement refresh token rotation strategy.
     */
    refresh(refreshToken: string): Promise<string>;
    /**
     * Revoke a token by its JTI (JWT ID), preventing future use.
     * Requires a revocation store (e.g. Redis blocklist) in infrastructure.
     *
     * TODO: Implement token revocation in infrastructure/tokens/
     */
    revoke(jti: string): Promise<void>;
}
//# sourceMappingURL=TokenService.d.ts.map