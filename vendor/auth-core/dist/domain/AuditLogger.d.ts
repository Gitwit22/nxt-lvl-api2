/**
 * auth-core/domain/AuditLogger.ts
 *
 * Contract for emitting structured audit events from auth-core use cases.
 * Concrete implementations (console, database, audit-core adapter) live in
 * infrastructure/ and are injected at runtime.
 *
 * auth-core emits events; it does not decide where they go.
 */
/**
 * The set of auth-related events that can be audited.
 */
export type AuthAuditAction = 'auth.login.succeeded' | 'auth.login.failed' | 'auth.logout.succeeded' | 'auth.password.reset.requested' | 'auth.password.reset.completed' | 'auth.password.reset.admin-enabled' | 'auth.session.revoked' | 'auth.route.access.denied';
/**
 * Minimal actor shape used across auth audit events.
 */
export interface AuditActor {
    userId?: string;
    email?: string;
    roles?: string[];
}
/**
 * Request metadata associated with an auth event.
 */
export interface AuditContext {
    ipAddress?: string;
    userAgent?: string;
    requestId?: string;
    metadata?: Record<string, unknown>;
}
/**
 * Structured auth event emitted by auth-core use cases.
 */
export interface AuthAuditEvent {
    action: AuthAuditAction;
    actor?: AuditActor;
    subjectUserId?: string;
    sessionId?: string;
    occurredAt: Date;
    outcome: 'success' | 'failure';
    context?: AuditContext;
    details?: Record<string, unknown>;
}
/**
 * AuditLogger is implemented by adapters that forward auth events to logs,
 * a dedicated audit-core package, or an external SIEM.
 */
export interface AuditLogger {
    log(event: AuthAuditEvent): Promise<void>;
}
//# sourceMappingURL=AuditLogger.d.ts.map