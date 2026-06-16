/**
 * Infrastructure adapters belong here.
 *
 * TODO: Add concrete implementations for repositories, password hashing,
 * token signing, and session persistence.
 */
export interface AuthInfrastructurePlaceholder {
    readonly name: 'auth-infrastructure-placeholder';
}
export declare const authInfrastructurePlaceholder: AuthInfrastructurePlaceholder;
export * from './passwords';
export * from './repositories';
export * from './sessions';
export * from './tokens';
//# sourceMappingURL=index.d.ts.map