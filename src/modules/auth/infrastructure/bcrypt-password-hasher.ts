import { Injectable } from '@nestjs/common';
import { hash, compare } from 'bcrypt';
import type { PasswordHasher } from '@nxtlvl/auth-core';

@Injectable()
export class BcryptPasswordHasher implements PasswordHasher {
  async hash(plainText: string): Promise<string> {
    return hash(plainText, 12);
  }

  async compare(plainText: string, storedHash: string): Promise<boolean> {
    return compare(plainText, storedHash);
  }
}
