import { Injectable } from '@nestjs/common';
import type {
  AuthAccount,
  AuthRepository,
  AuthSession,
  AuthUser,
  CreateAccountInput,
  CreateUserInput,
  EmergencyResetCode,
  PasswordResetRequest,
  SecurityQuestion,
} from '@nxtlvl/auth-core';
import { PrismaService } from '../../../prisma/prisma.service';

type AdminRow = {
  id: string;
  email: string;
  passwordHash: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function toAuthUser(admin: AdminRow): AuthUser {
  return {
    id: admin.id,
    email: admin.email,
    displayName:
      [admin.firstName, admin.lastName].filter(Boolean).join(' ') || admin.email,
    roles: [admin.role],
    isActive: admin.isActive,
    isEmailVerified: true,
    requiresPasswordReset: false,
    createdAt: admin.createdAt,
    updatedAt: admin.updatedAt,
  };
}

function toAuthAccount(admin: AdminRow): AuthAccount {
  return {
    id: admin.id,
    userId: admin.id,
    email: admin.email,
    passwordHash: admin.passwordHash,
    isLocked: false,
    failedLoginAttempts: 0,
    lastLoginAt: admin.lastLoginAt ?? undefined,
    createdAt: admin.createdAt,
    updatedAt: admin.updatedAt,
  };
}

@Injectable()
export class PrismaAuthRepository implements AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findUserById(id: string): Promise<AuthUser | undefined> {
    const admin = await this.prisma.adminUser.findUnique({ where: { id } });
    return admin ? toAuthUser(admin as AdminRow) : undefined;
  }

  async findUserByEmail(email: string): Promise<AuthUser | undefined> {
    const admin = await this.prisma.adminUser.findUnique({
      where: { email: email.toLowerCase() },
    });
    return admin ? toAuthUser(admin as AdminRow) : undefined;
  }

  async findAccountByEmail(email: string): Promise<AuthAccount | undefined> {
    const admin = await this.prisma.adminUser.findUnique({
      where: { email: email.toLowerCase() },
    });
    return admin ? toAuthAccount(admin as AdminRow) : undefined;
  }

  async findAccountByUserId(userId: string): Promise<AuthAccount | undefined> {
    const admin = await this.prisma.adminUser.findUnique({ where: { id: userId } });
    return admin ? toAuthAccount(admin as AdminRow) : undefined;
  }

  async updateAccount(id: string, patch: Partial<AuthAccount>): Promise<AuthAccount> {
    const data: Record<string, unknown> = { updatedAt: patch.updatedAt ?? new Date() };
    if (patch.lastLoginAt !== undefined) data['lastLoginAt'] = patch.lastLoginAt;
    const admin = await this.prisma.adminUser.update({ where: { id }, data });
    return toAuthAccount(admin as AdminRow);
  }

  async updateUser(id: string, _patch: Partial<AuthUser>): Promise<AuthUser> {
    const admin = await this.prisma.adminUser.findUniqueOrThrow({ where: { id } });
    return toAuthUser(admin as AdminRow);
  }

  // ── Session (stateless JWT — no server-side persistence) ──
  async createSession(_session: AuthSession): Promise<void> { /* no-op */ }
  async findSessionById(_id: string): Promise<AuthSession | undefined> { return undefined; }
  async findSessionsByUserId(_userId: string): Promise<AuthSession[]> { return []; }
  async invalidateSession(_sessionId: string): Promise<void> { /* no-op */ }
  async invalidateAllSessionsForUser(_userId: string): Promise<void> { /* no-op */ }

  // ── Not used by LoginUseCase — stubbed ──
  async createUser(_input: CreateUserInput): Promise<AuthUser> { throw new Error('Not implemented'); }
  async createAccount(_input: CreateAccountInput): Promise<AuthAccount> { throw new Error('Not implemented'); }
  async deactivateUser(_id: string): Promise<void> { throw new Error('Not implemented'); }
  async createPasswordResetRequest(_r: PasswordResetRequest): Promise<void> { throw new Error('Not implemented'); }
  async findPendingPasswordResetByTokenHash(_h: string): Promise<PasswordResetRequest | undefined> { return undefined; }
  async consumePasswordResetRequest(_id: string): Promise<void> { throw new Error('Not implemented'); }
  async clearPasswordResetRequests(_userId: string): Promise<void> { /* no-op */ }
  async saveSecurityQuestions(_q: SecurityQuestion[]): Promise<void> { throw new Error('Not implemented'); }
  async findSecurityQuestionsByUserId(_userId: string): Promise<SecurityQuestion[]> { return []; }
  async saveEmergencyResetCode(_c: EmergencyResetCode): Promise<void> { throw new Error('Not implemented'); }
  async findEmergencyResetCode(_userId: string): Promise<EmergencyResetCode | undefined> { return undefined; }
  async consumeEmergencyResetCode(_id: string): Promise<void> { throw new Error('Not implemented'); }
}
