# Security Architecture Improvements

## Overview

This document outlines the critical security improvements implemented to harden the authentication and authorization system.

---

## 1. Role Hierarchy Refactoring

### Previous Structure (Problematic)
```
Single role across all contexts:
- super_admin: Owned both platform and organization resources
- org_admin: Organization-level admin
- reviewer: Read-only
```

**Problem**: EA Lake was a platform-wide `super_admin`, giving unnecessary system-wide privileges for local organization management.

### New Structure (Secure)
```
Two-tier role system:

Platform Level (system-wide):
  - platform_super_admin: NXT LVL tech team only
    Access: All organizations, system configuration, user management

Organization Level (scoped):
  - org_owner: EA Lake (for EA Management LLC)
    Access: Only their own organization
    Ability: Cannot be changed/removed by admins
  
  - org_admin: EA Staff, etc.
    Access: Organization resources only
    Ability: Manage users and content within organization
  
  - reviewer: Limited permissions
    Access: View and provide feedback
```

**Benefit**: Principle of Least Privilege - users only have access to what they need.

---

## 2. Organization Membership Model

### Previous Structure
```
AdminUser {
  organizationId: string  // Single org per user
  role: AdminRole
}
```

**Problem**: Model assumes all users are administrators; cannot support non-admin roles.

### New Structure
```
AdminUser {
  id: string
  email: string
  platformRole?: PlatformRole  // System-wide role (if any)
  isActive: boolean
  // ✅ No organizationId - users can belong to multiple orgs
}

OrganizationMember {
  id: string
  adminUserId: string
  organizationId: string
  organizationRole: OrganizationRole  // org_owner, org_admin, reviewer
  isActive: boolean
  invitedAt: DateTime
  joinedAt?: DateTime
  invitedByMemberId?: string
}
```

**Benefit**: Flexible membership model supporting multiple organizations per user.

### Migration Path
```
Old endpoint:        POST /auth/invite-admin
New endpoints:       POST   /organizations/:orgId/invitations
                    GET    /organizations/:orgId/members
                    GET    /organizations/:orgId/members/:memberId
                    PATCH  /organizations/:orgId/members/:memberId
                    POST   /organizations/:orgId/members/:memberId/disable
                    POST   /organizations/:orgId/members/:memberId/enable
```

---

## 3. JWT Token Hardening

### Previous Implementation (Insecure)
```
Single Bearer Token:
- Issued: 24 hours validity
- Never rotated
- No session tracking
- Single logout invalidates nothing
- Stolen token = 24 hours of access
```

**Problems**:
- Long expiration window increases exposure
- No revocation mechanism
- No session management
- Tokens accumulate without cleanup

### New Implementation (Secure)
```
Dual-Token System:

Access Token (15-60 minutes):
  - Short-lived, frequently rotated
  - Contains: user context, organization role
  - Valid only for API requests
  - Stored in memory, HttpOnly cookie, or secure variable

Refresh Token (7 days):
  - Longer-lived, used only for obtaining new access tokens
  - Never sent to API endpoints
  - Stored only in HttpOnly Secure SameSite cookie
  - Rotated on each refresh

Session Tracking:
  - JTI (JWT ID) unique per session
  - Database session records with revocation support
  - Logout: Revoke session immediately
  - Password change: Revoke all sessions
  - Account disabled: Revoke all sessions
```

### JWT Claims (Strict Validation)
```typescript
{
  // Required by OAuth/OIDC standards
  alg: 'HS256',           // ✅ Fixed, not negotiable
  iss: 'ea-management-api', // ✅ Issuer verification
  aud: 'clientflow-web',  // ✅ Audience verification
  sub: 'user-id',         // ✅ Subject validation
  exp: 1234567890,        // ✅ Expiration check
  iat: 1234567000,        // ✅ Issued-at validation
  
  // Custom
  jti: 'unique-session-id', // ✅ Session identifier
  type: 'access'          // ✅ Token type
}
```

**Server-side validation**:
```typescript
// NEVER trust the client to specify algorithm
const decoded = jwt.verify(token, secret, {
  algorithms: ['HS256']  // ✅ Fixed, whitelist only
});
```

---

## 4. HTTP-Only Cookie-Based Sessions

### Previous Implementation (XSS Vulnerable)
```javascript
// Frontend stores token in localStorage
localStorage.setItem('token', accessToken);

// Available to any JavaScript code (including injected scripts)
const token = localStorage.getItem('token');
```

**Problems**:
- XSS vulnerability exposes token to injected JavaScript
- No HttpOnly protection
- Tokens persist across sessions unnecessarily
- No CSRF protection

### New Implementation (Secure)
```typescript
// Backend sets HttpOnly cookie on login
res.setHeader('Set-Cookie', [
  `__Host-clientflow_session=${accessToken}; ` +
  `HttpOnly; ` +           // ✅ JavaScript cannot access
  `Secure; ` +             // ✅ HTTPS only
  `SameSite=Lax; ` +       // ✅ CSRF protection
  `Path=/; ` +
  `Max-Age=${30 * 60}`     // ✅ 30 minutes
]);
```

Frontend automatically sends cookies with credentials:
```typescript
// Frontend - no token management needed
fetch(`${API_URL}/organizations`, {
  credentials: 'include'  // ✅ Sends cookies automatically
});
```

### CORS Configuration (Multi-Origin)
```typescript
// Safe for cross-origin requests
app.use(cors({
  origin: [
    'https://staging.clientflow.app',
    'https://prod.clientflow.app'
  ],
  credentials: true,  // ✅ Allow credentials
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type']
}));
```

### CSRF Protection
```typescript
// Without credentials, CSRF risk is minimal
// With HttpOnly cookies and SameSite=Lax, browser handles most cases

// For additional protection (optional):
// 1. Double-submit cookie pattern
// 2. Synchronizer token pattern
// 3. Custom header requirement
```

---

## 5. Organization Access Enforcement

### Problem Scenario
```
GET /organizations/org_evil/settings

Without enforcement:
- If attacker knows org ID, they can access any organization!
- No membership verification
- No organization status check
```

### Solution: OrganizationAccessGuard
```typescript
@UseGuards(JwtAuthGuard, OrganizationAccessGuard)
@Get('/organizations/:organizationId/settings')
async getSettings(@Req() req) {
  // Request reaches here only if ALL checks pass:
  // ✅ JWT is valid
  // ✅ Organization exists
  // ✅ Organization status is 'active'
  // ✅ User is platform_super_admin OR has active organization membership
  // ✅ Organization membership is active
  
  const organization = req.organization;  // Verified safe
  const membership = req.membership;      // Verified safe
}
```

**Guard validates**:
```
1. User is authenticated (JWT valid)
2. Organization exists
3. Organization status is 'active'
4. User is either:
   a) platform_super_admin (can access all orgs)
   b) Has active membership in organization
5. Membership status is active
```

---

## 6. Database Session Management

### Session Model
```typescript
model Session {
  id              String    @id @default(cuid())
  adminUserId     String
  jti             String    @unique    // Correlates with JWT
  accessToken     String                // Stored for audit
  accessExpiresAt DateTime
  refreshToken    String?
  refreshExpiresAt DateTime?
  revokedAt       DateTime?             // Logout time
  ipAddress       String?               // For security audit
  userAgent       String?               // For security audit
  createdAt       DateTime
  updatedAt       DateTime
  
  adminUser       AdminUser
}
```

### Session Revocation Events
1. **Logout**: User clicks logout
   - `revokedAt` set immediately
   - Next request with that token rejected

2. **Password Change**: User changes password
   - All sessions revoked for that user
   - User redirected to login on all devices

3. **Account Disabled**: Admin disables user
   - All sessions revoked immediately
   - User locked out across all devices

4. **Token Expired**: Access or refresh token expires
   - Automatic cleanup by scheduler
   - User must login again

---

## 7. Frontend Environment Variables

### Secure Pattern
```env
# Public values (safe in browser code)
VITE_API_URL=https://api-staging.example.com
VITE_APP_ENV=staging
VITE_APP_NAME=EA Management Client Portal

# ✅ NOT used in frontend at all
# Secrets never use VITE_ prefix
# Backend only:
JWT_SECRET=...
DATABASE_URL=...
API_KEYS=...
```

### Why Vite Prefixing Matters
```typescript
// ❌ Bad: Stored in browser bundle
process.env.VITE_SECRET_API_KEY  // Visible in source

// ✅ Good: Never leaked
process.env.SERVER_SECRET_API_KEY  // Only on backend
```

---

## 8. Implementation Checklist

### Backend Changes Required
- [x] Schema: New PlatformRole and OrganizationRole enums
- [x] Schema: OrganizationMember model for flexible membership
- [x] Schema: Session model for token tracking
- [x] Auth Service: Access/refresh token flow
- [x] Auth Service: Session management and revocation
- [x] Auth Service: Strict JWT validation
- [x] Guards: Organization access verification
- [x] Seed: Updated with new role structure

### Frontend Changes Required
- [ ] Remove localStorage usage for tokens
- [ ] Implement HttpOnly cookie-based sessions
- [ ] Use `fetch(..., { credentials: 'include' })`
- [ ] Add session refresh logic (optional, handled by server)
- [ ] Add session expiration warning (optional)
- [ ] Environment variables review (remove VITE_ from secrets)
- [ ] CORS configuration for multiple origins

### DevOps Changes Required
- [ ] Update CORS policy for each environment
- [ ] HTTPS enforcement (Secure cookie requires HTTPS)
- [ ] Session cleanup job (optional, expired sessions)
- [ ] Monitoring: Watch for revoked session usage
- [ ] Logging: Track session creation/revocation

---

## 9. Security Comparison

### Before vs After

| Aspect | Before | After |
|--------|--------|-------|
| **Token Lifetime** | 24 hours | Access: 30 min, Refresh: 7 days |
| **Revocation** | None | Immediate via Session table |
| **XSS Protection** | None | HttpOnly cookies |
| **CSRF Protection** | None | SameSite=Lax |
| **Role Hierarchy** | Flat | Tiered (Platform + Org) |
| **Membership Model** | Single org per user | Multiple orgs per user |
| **Session Tracking** | None | Full audit trail |
| **Platform Access** | Decentralized | Centralized super admin |
| **Organization Isolation** | No enforcement | Strict enforcement |
| **Password Change** | Doesn't invalidate sessions | All sessions revoked |

---

## 10. Migration Path

### Phase 1: Database (Week 1)
```bash
npm run prisma:migrate -- --name add_new_auth_models
npm run prisma:seed  # Test new seeding
```

### Phase 2: Backend Services (Week 2)
- Implement EnhancedJwtTokenService
- Implement OrganizationMembershipService
- Add OrganizationAccessGuard
- Update seed script
- Test all auth flows

### Phase 3: Frontend Changes (Week 2-3)
- Remove localStorage token storage
- Implement HttpOnly cookie handling
- Update API calls to use `credentials: 'include'`
- Add refresh token logic
- Test multi-origin scenarios

### Phase 4: Staging Deployment (Week 3)
- Deploy backend with new auth system
- Test frontend integration
- Monitor session creation/revocation
- Load test session cleanup

### Phase 5: Production Deployment (Week 4)
- Deploy to production
- Monitor closely for first 24h
- Have rollback plan ready
- Notify users of new login requirement

---

## 11. Security Audit Checklist

Before going to production:

- [ ] JWT validation validates all required claims
- [ ] Algorithm is hardcoded to 'HS256' on server
- [ ] Refresh tokens are stored securely in HttpOnly cookies
- [ ] Access tokens never stored in localStorage
- [ ] All organization endpoints verify membership
- [ ] Platform admins can access any organization
- [ ] Organization owners cannot be removed
- [ ] Password changes revoke all sessions
- [ ] Account disable revokes all sessions
- [ ] Session revocation prevents token reuse
- [ ] CORS allows only legitimate origins
- [ ] HTTPS enforced in production
- [ ] SameSite cookie attribute set
- [ ] Secure cookie attribute set in production
- [ ] Frontend environment variables reviewed

---

## 12. Runtime Monitoring

### Alerts to Configure
1. **High rate of invalid tokens**: Possible attack attempt
2. **Token refresh failure**: User session invalidated
3. **Session revocation spam**: Unusual logout pattern
4. **Cross-org access attempts**: Authorization bypass attempt
5. **Session from new IP**: Possible account compromise

### Logs to Collect
- Session creation (user, org, IP, user agent)
- Token refresh events
- Revocation events (type, reason)
- Failed authorization checks
- Algorithm negotiation attempts
- Expired session access attempts

---

**Implementation Date**: 2026-08-06  
**Status**: Architecture Designed, Implementation Ready  
**Next Step**: Database migration and backend implementation
