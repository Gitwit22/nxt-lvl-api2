/**
 * auth-core/domain/PasswordHasher.ts
 *
 * Interface for hashing and verifying passwords.
 * Concrete implementations (bcrypt, argon2, scrypt) live in infrastructure/.
 *
 * This abstraction keeps auth-core free from any specific hashing library,
 * making it easy to swap algorithms without touching business logic.
 */
/**
 * PasswordHasher defines the contract for password hashing and verification.
 *
 * Implementation requirements:
 * - Use a modern, slow, salted hashing algorithm (Argon2id recommended, bcrypt acceptable)
 * - Never store or log plain-text passwords anywhere in the chain
 * - The `hash` method must produce a self-contained string (includes salt + params)
 * - The `compare` method must be timing-safe to prevent timing attacks
 *
 * TODO: Provide a BcryptPasswordHasher and Argon2PasswordHasher in infrastructure/
 */
export interface PasswordHasher {
    /**
     * Hash a plain-text password.
     * @param plainText - The raw password from the user. Must not be stored.
     * @returns A self-contained hash string safe to persist.
     */
    hash(plainText: string): Promise<string>;
    /**
     * Verify a plain-text password against a stored hash.
     * Must use a constant-time comparison to prevent timing attacks.
     * @param plainText - The raw password submitted by the user.
     * @param hash - The previously stored hash.
     * @returns true if the password matches the hash.
     */
    compare(plainText: string, hash: string): Promise<boolean>;
}
//# sourceMappingURL=PasswordHasher.d.ts.map