# Development Order: Phase 1 & Phase 2 Implementation

## Overview

This document outlines the correct development order for establishing the EA Management LLC organization and implementing authentication for ClientFlow Hub.

**Current Status**: ✅ Phase 1 & Phase 2 infrastructure created and ready for testing

---

## Phase 1: Establish the EA Management Organization

### Objective
Create an organization record for EA Management LLC with proper settings and load org config dynamically from backend (not hardcoded in frontend).

### Implementation Status: ✅ COMPLETE

#### 1. Organization Record Created
- **Organization ID**: Auto-generated CUID
- **Name**: EA Management LLC
- **Slug**: `ea-management`
- **Status**: `active`
- **Environment**: `demo`

**Location**: [prisma/seed.ts](prisma/seed.ts#L1)

#### 2. Organization Settings Configured
```json
{
  "companyName": "EA Management LLC",
  "timezone": "America/Detroit",
  "currency": "USD",
  "environment": "demo",
  "branding": {
    "logoUrl": null,
    "primaryColor": null
  },
  "features": {
    "fundingPrograms": true,
    "documentManagement": true,
    "financialTracking": true,
    "communications": true
  }
}
```

**Location**: [src/config/program.partition.json](src/config/program.partition.json)

#### 3. Programs Created
- **Primary Program**: "Client Intake & Workflow" (slug: `client-intake`)
- **Type**: `business_directory`
- **Status**: `active`

#### 4. Organizations Service & Controller
- ✅ [OrganizationsService](src/modules/organizations/organizations.service.ts)
- ✅ [OrganizationsController](src/modules/organizations/organizations.controller.ts)
- ✅ Endpoints to load organization settings after login

### Frontend Integration (Phase 1)

**Recommended Flow**:
1. User logs in with credentials
2. Backend returns `organizationId` in auth response
3. Frontend calls `GET /organizations/{organizationId}/settings` with JWT token
4. Frontend caches organization settings in state/context
5. Use organization config throughout app (timezone, currency, branding, features, etc.)

**Advantages**:
- ✅ No hardcoding of "EA Management" throughout frontend
- ✅ Easy to switch organizations (multi-tenancy ready)
- ✅ Organization settings can be updated without redeploying frontend
- ✅ Proper separation of concerns

---

## Phase 2: Implement Authentication

### Objective
Use individual accounts (not one shared company login) with proper role-based access control.

### Implementation Status: ✅ COMPLETE (Backend endpoints ready)

#### 1. Authentication Infrastructure

**Existing**:
- ✅ Auth module with JWT-based authentication
- ✅ Bcrypt password hashing
- ✅ Admin JWT guard for protecting routes
- ✅ Audit logging

**Enhanced**:
- ✅ [AuthService](src/modules/auth/auth.service.ts) - Added 13 new methods
- ✅ [AuthController](src/modules/auth/auth.controller.ts) - Added 11 new endpoints
- ✅ [AuthDTOs](src/modules/auth/dto/auth.dto.ts) - Complete request/response types

#### 2. Production Test Users

| Email | Name | Role | Purpose | Password |
|-------|------|------|---------|----------|
| `nxtlvltechllc@gmail.com` | NXT LVL Tech | `super_admin` | Platform Admin | `4755Dett` |
| `eammanagementllc@gmail.com` | EA Management | `org_admin` | Organization Admin | `mbba2026` |

**Location**: [prisma/seed.ts](prisma/seed.ts#L174-L244)

#### 3. Authentication Endpoints

### Available Endpoints

#### Login Endpoints
- **POST** `/auth/login` - Individual account login with email/password
- **POST** `/auth/logout` - Logout and invalidate session

#### User Profile
- **GET** `/auth/me` - Get current authenticated user info
- **GET** `/auth/session-status` - Check if JWT token is still valid

#### Password Management
- **POST** `/auth/change-password` - Change own password (authenticated user)
- **POST** `/auth/forgot-password` - Initiate password reset flow
- **POST** `/auth/reset-password` - Complete password reset with token

#### Admin Invitation & Onboarding
- **POST** `/auth/invite-admin` - Invite new team member (org_admin+ required)
- **POST** `/auth/accept-invitation` - Accept invitation and create account
- **POST** `/auth/check-email` - Check if email exists
- **POST** `/auth/resend-verification-email` - Resend verification email

#### Admin User Management
- **POST** `/auth/disable-user/:userId` - Disable user account (org_admin+ required)
- **POST** `/auth/enable-user/:userId` - Re-enable disabled user (org_admin+ required)

#### Organization Endpoints (Protected)
- **GET** `/organizations/{orgId}/settings` - Load org config
- **GET** `/organizations/{orgId}/admins` - List all admin users
- **GET** `/organizations/{orgId}/admins/{adminId}` - Get specific admin details

---

## Role-Based Access Control

### Role Hierarchy
```
super_admin (EA Lake, NXT LVL Support)
    ├─ Full system access
    ├─ Can manage all organizations
    ├─ Can invite/disable users
    └─ Can view all audit logs

org_admin (EA Staff Member)
    ├─ Organization management
    ├─ Can invite team members
    ├─ Can manage workflows
    └─ Can view audit logs

reviewer (Demo User)
    ├─ View-only access
    ├─ Can submit form responses
    └─ Cannot modify data
```

---

## Required Authentication Features

### ✅ Implemented
- [x] Login with email/password
- [x] Logout
- [x] Get current user (me)
- [x] Change password (authenticated user)
- [x] Forgot password initiation
- [x] Session expiration handling
- [x] Disabled-user handling
- [x] Unauthorized-page handling
- [x] Audit logging for all auth actions

### ⚠️ TODO: Email Service Integration

The following features require integration with an email service (SendGrid, Resend, AWS SES, etc.):

1. **Password Reset Emails**
   - Generate secure reset token
   - Send email with reset link
   - Validate token before allowing password change
   - **Status**: Stub implementation with TODO comments

2. **Admin Invitation Emails**
   - Generate invitation token
   - Send email with acceptance link
   - Track invitation status
   - **Status**: Stub implementation with TODO comments

3. **Email Verification**
   - Send verification email on signup
   - Validate email before login
   - Resend verification email
   - **Status**: Stub implementation with TODO comments

### 📌 Note on Third-Party Auth Services

**Recommendation**: Consider migrating to a third-party authentication provider for production:

| Provider | Pros | Cons |
|----------|------|------|
| **Clerk** | Easy setup, modern UI, managed sessions | Cost, limited customization |
| **Auth0** | Comprehensive, enterprise features | Complex setup, cost |
| **Supabase Auth** | Open source, built-in database integration | Supabase-dependent |
| **Cloudflare Access** | Global edge, low cost | Internal-only by default |

Current implementation allows easy migration to any of these by:
1. Keeping auth service interface stable
2. Swapping implementation details only
3. Minimal frontend changes needed

---

## Testing Guide

### 1. Seed Database

```bash
npm run prisma:seed
```

This will:
- Create EA Management LLC organization
- Create all programs and categories
- Create 4 test admin users
- Display test credentials in console

### 2. Test Login Endpoints

**Login (EA Lake - Organization Owner)**
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "nxtlvltechllc@gmail.com",
    "password": "4755Dett"
  }'
```

**Response**:
```json
{
  "accessToken": "eyJhbGc...",
  "admin": {
    "id": "cuid123",
    "email": "nxtlvltechllc@gmail.com",
    "firstName": "NXT LVL",
    "lastName": "Tech",
    "role": "super_admin",
    "organizationId": "cuid456"
  }
}
```

### 3. Test Organization Settings Endpoint

**Get Organization Settings**
```bash
curl -X GET http://localhost:3000/organizations/{organizationId}/settings \
  -H "Authorization: Bearer {accessToken}" \
  -H "x-admin-id: {adminId}"
```

**Response**:
```json
{
  "id": "cuid456",
  "name": "EA Management LLC",
  "slug": "ea-management",
  "status": "active",
  "settings": {
    "companyName": "EA Management LLC",
    "timezone": "America/Detroit",
    "currency": "USD",
    "environment": "demo",
    "branding": { ... },
    "features": { ... }
  },
  "programs": [...]
}
```

### 4. Test User Management

**List Admin Users**
```bash
curl -X GET http://localhost:3000/organizations/{organizationId}/admins \
  -H "Authorization: Bearer {accessToken}" \
  -H "x-admin-id: {adminId}"
```

---

## Frontend Integration Checklist

### Phase 1: Organization Loading
- [ ] After successful login, store `organizationId`
- [ ] Call `GET /organizations/{organizationId}/settings`
- [ ] Store organization config in React Context/Redux
- [ ] Load branding (logo, primary color) from settings
- [ ] Use timezone from settings for date formatting
- [ ] Use currency from settings for amounts

### Phase 2: Authentication UI
- [ ] Create Login page with email/password form
- [ ] Create Logout button in main nav
- [ ] Create "Forgot Password" flow
- [ ] Create "Change Password" modal
- [ ] Create Admin Users management page (org_admin+ only)
- [ ] Create Invite New Admin workflow
- [ ] Handle session expiration (auto-logout)
- [ ] Show error for disabled accounts
- [ ] Add auth interceptor to API calls

### Phase 3: Email Integration (When Ready)
- [ ] Set up email provider (SendGrid, Resend, etc.)
- [ ] Update `/auth/forgot-password` to send emails
- [ ] Implement password reset page
- [ ] Update `/auth/invite-admin` to send invitations
- [ ] Implement invitation acceptance page

---

## Database Schema Reference

### Organization Model
```prisma
model Organization {
  id          String
  name        String
  slug        String      @unique
  status      String      @default("active")
  settings    Json?       // Stores org config
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
  
  programs    Program[]
  adminUsers  AdminUser[]
  auditLogs   AuditLog[]
}
```

### AdminUser Model
```prisma
model AdminUser {
  id                String
  organizationId    String
  email             String      @unique
  passwordHash      String
  firstName         String?
  lastName          String?
  role              AdminRole   // super_admin, org_admin, reviewer
  isActive          Boolean     @default(true)
  lastLoginAt       DateTime?
  createdAt         DateTime    @default(now())
  updatedAt         DateTime    @updatedAt
  
  organization      Organization
}
```

### AdminRole Enum
```prisma
enum AdminRole {
  super_admin    // Full system access
  org_admin      // Organization management
  reviewer       // View-only access
}
```

---

## Next Steps

### Immediate (Week 1)
1. ✅ Phase 1: Organization infrastructure deployed
2. ✅ Phase 2: Auth endpoints implemented
3. [ ] Seed production database with EA Management data
4. [ ] Frontend: Build login page
5. [ ] Frontend: Build organization settings loader

### Short Term (Week 2-3)
1. [ ] Frontend: Build org admin user management page
2. [ ] Frontend: Build admin invitation workflow
3. [ ] Integrate email service (SendGrid/Resend)
4. [ ] Implement password reset emails
5. [ ] Implement invitation emails

### Medium Term (Week 4+)
1. [ ] Security audit of auth implementation
2. [ ] Add 2FA (two-factor authentication) if needed
3. [ ] Consider migration to Clerk/Auth0 for production
4. [ ] Add role-based UI visibility (show/hide admin features)
5. [ ] Implement more granular permissions if needed

---

## Security Considerations

### ✅ Implemented
- Bcrypt password hashing (10+ rounds)
- JWT token-based authentication
- JWT validation on protected routes
- Audit logging for sensitive operations
- Disabled-user account lockout
- Password validation on change

### ⚠️ TODO for Production
- Add rate limiting on login attempts
- Add CSRF protection
- Add request signing/validation
- Implement refresh token rotation
- Add password complexity requirements
- Add email verification requirements
- Add IP whitelist/geolocation checks
- Add 2FA support

---

## Troubleshooting

### Issue: Users can't login
**Check**:
1. Run `npm run prisma:seed` to populate demo users
2. Verify email matches exactly (case-sensitive)
3. Check password is correct
4. Verify user's `isActive` is `true`

### Issue: Organization settings not loading
**Check**:
1. Verify JWT token is valid
2. Verify `organizationId` in request path matches user's organization
3. Check organization exists in database
4. Check organization `settings` is not null

### Issue: User invite not working
**Check**:
1. Acting user must have `org_admin` or `super_admin` role
2. Email must not already exist in database
3. Email service integration required (TODO)

---

## File References

| File | Purpose |
|------|---------|
| [program.partition.json](src/config/program.partition.json) | Organization & env config |
| [seed.ts](prisma/seed.ts) | Database seed with all test data |
| [organizations.service.ts](src/modules/organizations/organizations.service.ts) | Organization business logic |
| [organizations.controller.ts](src/modules/organizations/organizations.controller.ts) | Organization endpoints |
| [auth.service.ts](src/modules/auth/auth.service.ts) | Authentication business logic |
| [auth.controller.ts](src/modules/auth/auth.controller.ts) | Authentication endpoints |
| [auth.dto.ts](src/modules/auth/dto/auth.dto.ts) | Request/response types |

---

**Status**: ✅ Ready for Frontend Integration  
**Last Updated**: 2026-08-06  
**Next Review**: After frontend integration
