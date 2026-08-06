# ClientFlow Hub API - Complete Reference

## Base URL
```
Development: http://localhost:3000
Production: https://api.clientflow.app (TBD)
```

---

## Authentication

### Headers
```
Authorization: Bearer {accessToken}
x-admin-id: {adminId}
Content-Type: application/json
```

The `accessToken` is obtained from the login endpoint. The `x-admin-id` is the admin user's ID (also provided at login).

---

## Test Credentials

| Email | Password | Role | Purpose |
|-------|----------|------|---------|
| `nxtlvltechllc@gmail.com` | `4755Dett` | super_admin | Platform Admin |
| `eammanagementllc@gmail.com` | `mbba2026` | org_admin | Organization Admin |

---

## Authentication Endpoints

### 1. Login (Public)
**POST** `/auth/login`

Authenticate with email and password. Returns JWT token and user info.

**Request**:
```json
{
  "email": "nxtlvltechllc@gmail.com",
  "password": "4755Dett"
}
```

**Response**:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "admin": {
    "id": "cuid_123",
    "email": "nxtlvltechllc@gmail.com",
    "firstName": "NXT LVL",
    "lastName": "Tech",
    "role": "super_admin",
    "organizationId": "org_ea_management"
  }
}
```

**Status Codes**:
- `200 OK` - Login successful
- `401 Unauthorized` - Invalid credentials or disabled account
- `400 Bad Request` - Missing email or password

**cURL Example**:
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "nxtlvltechllc@gmail.com",
    "password": "4755Dett"
  }'
```

---

### 2. Get Current User (Protected)
**GET** `/auth/me`

Get information about the currently authenticated user.

**Headers**:
```
Authorization: Bearer {accessToken}
x-admin-id: {adminId}
```

**Response**:
```json
{
  "id": "cuid_123",
  "email": "nxtlvltechllc@gmail.com",
  "firstName": "NXT LVL",
  "lastName": "Tech",
  "role": "super_admin",
  "isActive": true,
  "organizationId": "org_ea_management",
  "lastLoginAt": "2024-01-15T10:30:00Z",
  "createdAt": "2024-01-01T08:00:00Z"
}
```

**Status Codes**:
- `200 OK` - User info retrieved
- `401 Unauthorized` - Invalid or expired token
- `404 Not Found` - User not found

**cURL Example**:
```bash
curl -X GET http://localhost:3000/auth/me \
  -H "Authorization: Bearer {accessToken}" \
  -H "x-admin-id: {adminId}"
```

---

### 3. Session Status (Protected)
**GET** `/auth/session-status`

Check if the current JWT session is still valid.

**Response**:
```json
{
  "valid": true,
  "admin": {
    "id": "cuid_123",
    "email": "nxtlvltechllc@gmail.com",
    "role": "super_admin",
    "isActive": true
  }
}
```

**cURL Example**:
```bash
curl -X GET http://localhost:3000/auth/session-status \
  -H "Authorization: Bearer {accessToken}" \
  -H "x-admin-id: {adminId}"
```

---

### 4. Logout (Protected)
**POST** `/auth/logout`

Log out and invalidate session (logs the action for audit).

**Response**:
```json
{
  "message": "Logged out successfully"
}
```

**cURL Example**:
```bash
curl -X POST http://localhost:3000/auth/logout \
  -H "Authorization: Bearer {accessToken}" \
  -H "x-admin-id: {adminId}"
```

---

### 5. Check Email Exists (Public)
**POST** `/auth/check-email`

Check if an email address is already registered.

**Request**:
```json
{
  "email": "nxtlvltechllc@gmail.com"
}
```

**Response**:
```json
{
  "exists": true,
  "email": "nxtlvltechllc@gmail.com"
}
```

**cURL Example**:
```bash
curl -X POST http://localhost:3000/auth/check-email \
  -H "Content-Type: application/json" \
  -d '{"email": "nxtlvltechllc@gmail.com"}'
```

---

## Password Management Endpoints

### 6. Change Password (Protected)
**POST** `/auth/change-password`

Change password for the currently authenticated user. Requires current password.

**Request**:
```json
{
  "currentPassword": "4755Dett",
  "newPassword": "NewSecurePassword@2024!"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

**Status Codes**:
- `200 OK` - Password changed
- `401 Unauthorized` - Invalid current password
- `400 Bad Request` - New password doesn't meet requirements

**cURL Example**:
```bash
curl -X POST http://localhost:3000/auth/change-password \
  -H "Authorization: Bearer {accessToken}" \
  -H "x-admin-id: {adminId}" \
  -H "Content-Type: application/json" \
  -d '{
    "currentPassword": "4755Dett",
    "newPassword": "NewSecurePassword@2024!"
  }'
```

---

### 7. Forgot Password (Public)
**POST** `/auth/forgot-password`

Initiate password reset process. Sends email with reset link.

**Request**:
```json
{
  "email": "nxtlvltechllc@gmail.com"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Check your email for password reset instructions. Link expires in 1 hour."
}
```

**Status Codes**:
- `200 OK` - Reset email sent (or friendly message if email not found)
- `400 Bad Request` - Missing email field

**Security Note**: Returns the same message regardless of whether email exists (prevents email enumeration).

**cURL Example**:
```bash
curl -X POST http://localhost:3000/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email": "nxtlvltechllc@gmail.com"}'
```

---

### 8. Reset Password (Public)
**POST** `/auth/reset-password`

Complete password reset using token from email link.

**Request**:
```json
{
  "resetToken": "token_from_email_link",
  "newPassword": "NewSecurePassword@2024!"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Password has been reset successfully. You can now login with your new password."
}
```

**Status Codes**:
- `200 OK` - Password reset complete
- `400 Bad Request` - Invalid or expired token
- `401 Unauthorized` - Token validation failed

**cURL Example**:
```bash
curl -X POST http://localhost:3000/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "resetToken": "abc123",
    "newPassword": "NewSecurePassword@2024!"
  }'
```

---

## Admin Management Endpoints

### 9. Invite Admin (Protected - org_admin+ required)
**POST** `/auth/invite-admin`

Send invitation to a new team member.

**Request**:
```json
{
  "email": "newadmin@company.com",
  "firstName": "John",
  "lastName": "Doe",
  "role": "reviewer"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Invitation sent to newadmin@company.com. They have 7 days to accept.",
  "admin": {
    "id": "new_admin_id",
    "email": "newadmin@company.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "reviewer",
    "organizationId": "org_ea_management"
  }
}
```

**Status Codes**:
- `201 Created` - Invitation sent
- `400 Bad Request` - Email already exists
- `403 Forbidden` - User lacks permission (must be org_admin+)

**cURL Example**:
```bash
curl -X POST http://localhost:3000/auth/invite-admin \
  -H "Authorization: Bearer {accessToken}" \
  -H "x-admin-id: {adminId}" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newadmin@company.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "reviewer"
  }'
```

---

### 10. Accept Invitation (Public)
**POST** `/auth/accept-invitation`

Accept an admin invitation and set password.

**Request**:
```json
{
  "invitationToken": "token_from_email",
  "password": "SecurePassword@2024!"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Invitation accepted. You can now login.",
  "admin": {
    "id": "new_admin_id",
    "email": "newadmin@company.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "reviewer",
    "isActive": true
  }
}
```

**Status Codes**:
- `200 OK` - Invitation accepted
- `400 Bad Request` - Invalid or expired token
- `401 Unauthorized` - Token validation failed

**cURL Example**:
```bash
curl -X POST http://localhost:3000/auth/accept-invitation \
  -H "Content-Type: application/json" \
  -d '{
    "invitationToken": "abc123",
    "password": "SecurePassword@2024!"
  }'
```

---

## Organization Endpoints

### 11. Get Organization Settings (Protected)
**GET** `/organizations/:organizationId/settings`

Load organization configuration (branding, features, timezone, etc.) for the frontend.

**Response**:
```json
{
  "id": "org_ea_management",
  "name": "EA Management LLC",
  "settings": {
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
}
```

**Status Codes**:
- `200 OK` - Settings retrieved
- `401 Unauthorized` - Invalid token
- `404 Not Found` - Organization not found

**cURL Example**:
```bash
curl -X GET http://localhost:3000/organizations/org_ea_management/settings \
  -H "Authorization: Bearer {accessToken}" \
  -H "x-admin-id: {adminId}"
```

---

### 12. List Organization Admins (Protected)
**GET** `/organizations/:organizationId/admins`

Get list of all admin users in the organization.

**Response**:
```json
[
  {
    "id": "admin_1",
    "email": "nxtlvltechllc@gmail.com",
    "firstName": "NXT LVL",
    "lastName": "Tech",
    "role": "super_admin",
    "isActive": true,
    "lastLoginAt": "2024-01-15T10:30:00Z"
  },
  {
    "id": "admin_2",
    "email": "eammanagementllc@gmail.com",
    "firstName": "EA",
    "lastName": "Management",
    "role": "org_admin",
    "isActive": true,
    "lastLoginAt": "2024-01-14T14:20:00Z"
  }
]
```

**Status Codes**:
- `200 OK` - List retrieved
- `401 Unauthorized` - Invalid token
- `404 Not Found` - Organization not found

**cURL Example**:
```bash
curl -X GET http://localhost:3000/organizations/org_ea_management/admins \
  -H "Authorization: Bearer {accessToken}" \
  -H "x-admin-id: {adminId}"
```

---

### 13. Get Admin Details (Protected)
**GET** `/organizations/:organizationId/admins/:adminId`

Get details for a specific admin user.

**Response**:
```json
{
  "id": "admin_1",
  "email": "nxtlvltechllc@gmail.com",
  "firstName": "NXT LVL",
  "lastName": "Tech",
  "role": "super_admin",
  "isActive": true,
  "lastLoginAt": "2024-01-15T10:30:00Z",
  "createdAt": "2024-01-01T08:00:00Z"
}
```

**Status Codes**:
- `200 OK` - Admin details retrieved
- `401 Unauthorized` - Invalid token
- `404 Not Found` - Admin not found

**cURL Example**:
```bash
curl -X GET http://localhost:3000/organizations/org_ea_management/admins/admin_1 \
  -H "Authorization: Bearer {accessToken}" \
  -H "x-admin-id: {adminId}"
```

---

## User Management Endpoints

### 14. Disable User (Protected - org_admin+ required)
**POST** `/auth/disable-user/:userId`

Disable a user account (prevents login).

**Response**:
```json
{
  "success": true,
  "message": "User eammanagementllc@gmail.com has been disabled.",
  "admin": {
    "id": "admin_2",
    "email": "eammanagementllc@gmail.com",
    "firstName": "EA",
    "lastName": "Management",
    "isActive": false
  }
}
```

**Status Codes**:
- `200 OK` - User disabled
- `403 Forbidden` - User lacks permission (must be org_admin+)
- `404 Not Found` - User not found

**cURL Example**:
```bash
curl -X POST http://localhost:3000/auth/disable-user/admin_2 \
  -H "Authorization: Bearer {accessToken}" \
  -H "x-admin-id: {adminId}"
```

---

### 15. Enable User (Protected - org_admin+ required)
**POST** `/auth/enable-user/:userId`

Re-enable a disabled user account.

**Response**:
```json
{
  "success": true,
  "message": "User eammanagementllc@gmail.com has been enabled.",
  "admin": {
    "id": "admin_2",
    "email": "eammanagementllc@gmail.com",
    "firstName": "EA",
    "lastName": "Management",
    "isActive": true
  }
}
```

**Status Codes**:
- `200 OK` - User enabled
- `403 Forbidden` - User lacks permission (must be org_admin+)
- `404 Not Found` - User not found

**cURL Example**:
```bash
curl -X POST http://localhost:3000/auth/enable-user/admin_2 \
  -H "Authorization: Bearer {accessToken}" \
  -H "x-admin-id: {adminId}"
```

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "statusCode": 400,
  "message": "Error message here",
  "error": "BadRequest"
}
```

### Common Status Codes
- `200 OK` - Request successful
- `201 Created` - Resource created
- `400 Bad Request` - Invalid request parameters
- `401 Unauthorized` - Authentication required or failed
- `403 Forbidden` - Access denied (insufficient permissions)
- `404 Not Found` - Resource not found
- `409 Conflict` - Resource already exists
- `500 Internal Server Error` - Server error

---

## Example Login Flow

### Step 1: Login
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "nxtlvltechllc@gmail.com",
    "password": "4755Dett"
  }'
```

Response:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "admin": {
    "id": "admin_1",
    "email": "nxtlvltechllc@gmail.com",
    "firstName": "NXT LVL",
    "lastName": "Tech",
    "role": "super_admin",
    "organizationId": "org_ea_management"
  }
}
```

### Step 2: Get Organization Settings
```bash
curl -X GET http://localhost:3000/organizations/org_ea_management/settings \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "x-admin-id: admin_1"
```

### Step 3: Use Settings in Frontend
- Display organization name from settings.companyName
- Use timezone for all date/time operations
- Use currency for all financial displays
- Enable/disable features based on features object

---

## Integration Checklist

- [ ] Review all endpoints and their requirements
- [ ] Implement login page (POST /auth/login)
- [ ] Store accessToken and adminId from response
- [ ] Implement organization settings loader (GET /organizations/{orgId}/settings)
- [ ] Cache organization settings in app state
- [ ] Add JWT token to all API request headers
- [ ] Handle 401 errors (redirect to login)
- [ ] Handle 403 errors (show access denied message)
- [ ] Implement session status check (GET /auth/session-status)
- [ ] Show session expiration warning (5 min before expiry)
- [ ] Implement logout (POST /auth/logout)

---

**Last Updated**: 2026-01-15  
**API Version**: 1.0.0  
**Status**: Ready for Testing
