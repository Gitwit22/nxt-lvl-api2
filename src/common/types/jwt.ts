/**
 * JWT Token Claims and Configuration
 * 
 * Access Token: 15-60 minutes (short-lived)
 * Refresh Token: 7 days (longer-lived)
 * 
 * All tokens require:
 * - alg: HS256 (fixed, not negotiable)
 * - exp: expiration time
 * - iat: issued at
 * - iss: issuer (ea-management-api)
 * - aud: audience (clientflow-web)
 * - sub: subject (admin user ID)
 * - jti: JWT ID (unique session identifier)
 */

export enum TokenType {
  ACCESS = 'access',
  REFRESH = 'refresh',
}

export interface JwtPayload {
  // Standard JWT claims
  alg: 'HS256';
  iss: string; // issuer
  aud: string; // audience
  sub: string; // subject (admin user ID)
  exp: number; // expiration time (unix timestamp)
  iat: number; // issued at (unix timestamp)
  
  // Custom claims
  jti: string; // JWT ID (unique session identifier)
  type: TokenType; // access or refresh
  
  // User context
  adminId: string;
  email: string;
  platformRole?: string;
  
  // Organization context (if applicable)
  organizationId?: string;
  organizationRole?: string;
}

export interface TokenConfig {
  issuer: string;
  audience: string;
  accessTokenExpiresIn: number; // seconds (15-60 minutes)
  refreshTokenExpiresIn: number; // seconds (7 days)
  algorithm: 'HS256';
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // access token expiration in seconds
  tokenType: 'Bearer';
}

export interface SessionData {
  id: string;
  adminId: string;
  jti: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
  revokedAt?: Date;
}

/**
 * Default token configuration
 * Can be overridden via environment variables
 */
export const DEFAULT_TOKEN_CONFIG: TokenConfig = {
  issuer: 'ea-management-api',
  audience: 'clientflow-web',
  accessTokenExpiresIn: 30 * 60, // 30 minutes
  refreshTokenExpiresIn: 7 * 24 * 60 * 60, // 7 days
  algorithm: 'HS256',
};
