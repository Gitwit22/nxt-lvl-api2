# Quick Start Guide - Phase 1 & Phase 2

## Overview

This guide will get you up and running with Phase 1 (Organization Setup) and Phase 2 (Authentication) for ClientFlow Hub's backend API.

---

## Prerequisites

- Node.js >= 18
- npm or yarn
- PostgreSQL database (local or remote)
- Git

---

## 1. Initial Setup

### Clone Repository & Install Dependencies

```bash
cd nxt-lvl-api2
npm install
```

### Configure Environment Variables

Create a `.env` file in the root directory:

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/clientflow_dev

# Environment
NODE_ENV=development
PORT=3000

# Auth
JWT_SECRET=your-secret-key-minimum-32-characters
JWT_EXPIRY=86400

# API
API_URL=http://localhost:3000
CORS_ORIGIN=http://localhost:5173,http://localhost:3000
```

### Set Up Database

```bash
# Create database migrations
npm run prisma:migrate

# Seed database with Phase 1 & Phase 2 data
npm run prisma:seed
```

**Output**:
```
🌱 Seeding database...

📦 Phase 1: Creating organization...
✅ Organization created: EA Management LLC (org_ea_management)

📋 Phase 1: Creating programs...
✅ Program created: Client Intake & Workflow (prog_123)

👥 Phase 2: Creating admin users...
✅ EA Lake (Organization Owner - Super Admin)
✅ EA Staff Member (Administrator/Case Manager)
✅ NXT LVL Technical Support (Platform Admin - Technical Support)
✅ Demo User (Restricted Tester - Reviewer)

📋 Seed Summary:
   Organization: EA Management LLC
   Program: Client Intake & Workflow
   Admin Users: 2

🔐 Test Credentials:
   NXT LVL Tech: nxtlvltechllc@gmail.com / 4755Dett
   EA Management: eammanagementllc@gmail.com / mbba2026

✨ Seeding complete!
```

---

## 2. Start Development Server

```bash
npm run start:dev
```

The API will be available at `http://localhost:3000`

**Expected Output**:
```
[Nest] 12345   - 01/15/2024, 10:30:00 AM     LOG [NestFactory] Starting Nest application...
[Nest] 12345   - 01/15/2024, 10:30:00 AM     LOG [InstanceLoader] DatabaseModule dependencies initialized
[Nest] 12345   - 01/15/2024, 10:30:01 AM     LOG [RoutesResolver] AuthController {/auth}:
[Nest] 12345   - 01/15/2024, 10:30:01 AM     LOG [RoutesResolver] OrganizationsController {/organizations}:
[Nest] 12345   - 01/15/2024, 10:30:01 AM     LOG [NestApplication] Nest application successfully started
```

---

## 3. Test Phase 1: Organization Setup

### 3.1 Verify Organization was Created

Open your database client (pgAdmin, DBeaver, etc.) and check:

**Query**:
```sql
SELECT id, name, slug, status, settings FROM "Organization" LIMIT 1;
```

**Expected Result**:
```
id: org_xxxx
name: EA Management LLC
slug: ea-management
status: active
settings: {
  "companyName": "EA Management LLC",
  "timezone": "America/Detroit",
  "currency": "USD",
  "environment": "demo",
  ...
}
```

### 3.2 Test Organization Settings Endpoint

First, get a token by logging in:

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
    "id": "admin_123",
    "organizationId": "org_ea_management",
    ...
  }
}
```

Then get organization settings:

```bash
curl -X GET http://localhost:3000/organizations/org_ea_management/settings \
  -H "Authorization: Bearer {accessToken}" \
  -H "x-admin-id: admin_123"
```

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
    "branding": {...},
    "features": {
      "fundingPrograms": true,
      "documentManagement": true,
      "financialTracking": true,
      "communications": true
    }
  },
  "programs": [
    {
      "id": "prog_123",
      "name": "Client Intake & Workflow",
      "slug": "client-intake",
      "type": "business_directory"
    }
  ]
}
```

✅ **Phase 1 Success**: Organization loads correctly with proper settings!

---

## 4. Test Phase 2: Authentication

### 4.1 Test Login with Different Roles

**Test 1: Platform Admin (super_admin)**
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "nxtlvltechllc@gmail.com",
    "password": "4755Dett"
  }'
```

**Test 2: Organization Admin (org_admin)**
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "eammanagementllc@gmail.com",
    "password": "mbba2026"
  }'
```

### 4.2 Test Get Current User

```bash
curl -X GET http://localhost:3000/auth/me \
  -H "Authorization: Bearer {accessToken}" \
  -H "x-admin-id: {adminId}"
```

### 4.3 Test Change Password

```bash
curl -X POST http://localhost:3000/auth/change-password \
  -H "Authorization: Bearer {accessToken}" \
  -H "x-admin-id: {adminId}" \
  -H "Content-Type: application/json" \
  -d '{
    "currentPassword": "4755Dett",
    "newPassword": "NewSecurePassword2024!"
  }'
```

### 4.4 Test List Admin Users

```bash
curl -X GET http://localhost:3000/organizations/org_ea_management/admins \
  -H "Authorization: Bearer {accessToken}" \
  -H "x-admin-id: {adminId}"
```

### 4.5 Test Logout

```bash
curl -X POST http://localhost:3000/auth/logout \
  -H "Authorization: Bearer {accessToken}" \
  -H "x-admin-id: {adminId}"
```

✅ **Phase 2 Success**: Authentication working with all test users!

---

## 5. Common Development Tasks

### Build Production

```bash
npm run build
```

This generates the NestJS build in the `dist` folder.

### Run Tests

```bash
npm run test
npm run test:watch
```

### Format & Lint Code

```bash
npm run format
npm run lint
```

### Reset Database

```bash
# Drop all tables and recreate
npm run prisma:migrate -- --name init --create-only

# Re-seed
npm run prisma:seed
```

### View Database Schema

```bash
npx prisma studio
```

Opens a visual editor at `http://localhost:5555`

---

## 6. Troubleshooting

### Issue: "Database connection failed"
**Solution**:
1. Check DATABASE_URL in .env is correct
2. Verify PostgreSQL is running
3. Check database exists: `psql -U user -d clientflow_dev -c "\dt"`

### Issue: "Port 3000 already in use"
**Solution**:
```bash
# Kill process using port 3000
lsof -i :3000
kill -9 <PID>

# Or use different port
PORT=3001 npm run start:dev
```

### Issue: "Module not found" errors
**Solution**:
```bash
rm -rf node_modules package-lock.json
npm install
```

### Issue: Seed data not creating users
**Solution**:
```bash
# Check database migrations ran
npx prisma migrate status

# Run pending migrations
npx prisma migrate deploy

# Then seed
npm run prisma:seed
```

### Issue: Login returns "Admin not found"
**Solution**:
1. Verify email is correct (case-sensitive)
2. Check user exists: `SELECT * FROM "AdminUser" WHERE email = 'ea.lake@ea-management.app';`
3. Re-run seed: `npm run prisma:seed`

---

## 7. Key Files & Documentation

| File | Purpose |
|------|---------|
| [DEVELOPMENT_ORDER.md](DEVELOPMENT_ORDER.md) | Detailed Phase 1 & Phase 2 implementation guide |
| [API_REFERENCE.md](API_REFERENCE.md) | Complete API endpoint documentation with cURL examples |
| [src/modules/organizations/](src/modules/organizations/) | Organization service & controller |
| [src/modules/auth/](src/modules/auth/) | Authentication service & controller |
| [prisma/schema.prisma](prisma/schema.prisma) | Database schema definitions |
| [prisma/seed.ts](prisma/seed.ts) | Database seed script with test data |
| [src/config/program.partition.json](src/config/program.partition.json) | Organization & environment config |

---

## 8. Next Steps

### For Backend Developers
1. ✅ Phase 1 & 2 complete
2. [ ] Add email service integration (SendGrid/Resend)
3. [ ] Implement password reset emails
4. [ ] Implement invitation emails
5. [ ] Add rate limiting & security features
6. [ ] Add more business logic endpoints

### For Frontend Developers
1. [ ] Call `POST /auth/login` to authenticate
2. [ ] Call `GET /organizations/{orgId}/settings` to load org config
3. [ ] Cache organization settings in app state
4. [ ] Build login page UI
5. [ ] Build logout functionality
6. [ ] Handle 401/403 errors appropriately
7. [ ] Build admin user management page

### For DevOps/Deployment
1. [ ] Set up production database
2. [ ] Configure environment variables for production
3. [ ] Set up CI/CD pipeline
4. [ ] Configure Render deployment (if using)
5. [ ] Set up monitoring & logging

---

## 8. Getting Help

### Documentation
- [Prisma Docs](https://www.prisma.io/docs/)
- [NestJS Docs](https://docs.nestjs.com/)
- [JWT Authentication](https://jwt.io/)

### Local Resources
- Backend team Slack channel
- Code review process for PRs
- Weekly architecture sync

---

**Status**: ✅ Ready for Frontend Integration  
**Last Updated**: 2026-01-15
