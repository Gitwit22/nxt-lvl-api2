/**
 * auth-core/domain/AuthRepository.ts
 *
 * The persistence contract for auth-core.
 * Concrete implementations (Postgres, Firestore, in-memory, etc.) live in
 * infrastructure/ and are injected at runtime — never referenced directly
 * from domain or application code.
 */
import type { AuthAccount, AuthUser, AuthSession, CreateAccountInput, CreateUserInput, PasswordResetRequest, SecurityQuestion, EmergencyResetCode } from './types';
/**
 * AuthRepository defines every persistence operation needed by auth-core.
 * Implement this interface for each storage backend you target.
 *
 * All methods are async to accommodate both synchronous (in-memory) and
 * asynchronous (database, cloud) adapters without API changes.
 */
export interface AuthRepository {
    /** Find a user by their unique ID. Returns undefined if not found. */
    findUserById(id: string): Promise<AuthUser | undefined>;
    /** Find a user by email address (case-insensitive). Returns undefined if not found. */
    findUserByEmail(email: string): Promise<AuthUser | undefined>;
    /** Persist a new user. Throws or rejects if the email already exists. */
    createUser(input: CreateUserInput): Promise<AuthUser>;
    /** Persist a new authentication account linked to a user. */
    createAccount(input: CreateAccountInput): Promise<AuthAccount>;
    /** Persist changes to an existing user record. */
    updateUser(id: string, patch: Partial<AuthUser>): Promise<AuthUser>;
    /** Persist changes to an existing auth account record. */
    updateAccount(id: string, patch: Partial<AuthAccount>): Promise<AuthAccount>;
    /** Soft-delete or deactivate a user account. */
    deactivateUser(id: string): Promise<void>;
    /** Find the auth account for a given user. */
    findAccountByUserId(userId: string): Promise<AuthAccount | undefined>;
    /** Find the auth account used for login by email address. */
    findAccountByEmail(email: string): Promise<AuthAccount | undefined>;
    /** Persist a new session after successful login. */
    createSession(session: AuthSession): Promise<void>;
    /** Retrieve an active session by session ID. Returns undefined if not found or expired. */
    findSessionById(sessionId: string): Promise<AuthSession | undefined>;
    /** Retrieve all active sessions for a given user (useful for admin tools). */
    findSessionsByUserId(userId: string): Promise<AuthSession[]>;
    /** Invalidate (delete or mark expired) a specific session. */
    invalidateSession(sessionId: string): Promise<void>;
    /** Invalidate all sessions for a user (used on password change, account lock, etc.). */
    invalidateAllSessionsForUser(userId: string): Promise<void>;
    /** Persist a new password reset request. */
    createPasswordResetRequest(request: PasswordResetRequest): Promise<void>;
    /**
     * Find a pending (unconsumed, unexpired) reset request by hashed token.
     * Returns undefined if no valid request exists.
     */
    findPendingPasswordResetByTokenHash(tokenHash: string): Promise<PasswordResetRequest | undefined>;
    /** Mark a password reset request as consumed so it cannot be reused. */
    consumePasswordResetRequest(requestId: string): Promise<void>;
    /** Remove all pending password reset requests for a user. */
    clearPasswordResetRequests(userId: string): Promise<void>;
    /** Store security questions (hashed answers) for a user. */
    saveSecurityQuestions(questions: SecurityQuestion[]): Promise<void>;
    /** Retrieve stored security questions for a user (answers remain hashed). */
    findSecurityQuestionsByUserId(userId: string): Promise<SecurityQuestion[]>;
    /** Store an emergency reset code (hashed) for a user. */
    saveEmergencyResetCode(code: EmergencyResetCode): Promise<void>;
    /** Find an unconsumed emergency reset code by hashed value. */
    findEmergencyResetCode(userId: string): Promise<EmergencyResetCode | undefined>;
    /** Mark an emergency reset code as used. */
    consumeEmergencyResetCode(codeId: string): Promise<void>;
}
//# sourceMappingURL=AuthRepository.d.ts.map