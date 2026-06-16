import type { AuthConfig } from '../../config/AuthConfig';
import type { AuditLogger } from '../../domain/AuditLogger';
import type { AuthRepository } from '../../domain/AuthRepository';
import type { PasswordHasher } from '../../domain/PasswordHasher';
import type { TokenService } from '../../domain/TokenService';
import { type LoginContext, type LoginCredentials, type LoginResult } from '../../domain/types';
export interface LoginUseCaseDependencies {
    authRepository: AuthRepository;
    passwordHasher: PasswordHasher;
    tokenService: TokenService;
    auditLogger: AuditLogger;
    config: AuthConfig;
    createSessionId?: () => string;
    now?: () => Date;
}
/**
 * LoginUseCase coordinates the core login workflow without binding to a UI
 * framework, transport, or storage implementation.
 */
export declare class LoginUseCase {
    private readonly authRepository;
    private readonly passwordHasher;
    private readonly tokenService;
    private readonly auditLogger;
    private readonly config;
    private readonly createSessionId;
    private readonly now;
    constructor(dependencies: LoginUseCaseDependencies);
    execute(credentials: LoginCredentials, context?: LoginContext): Promise<LoginResult>;
}
//# sourceMappingURL=LoginUseCase.d.ts.map