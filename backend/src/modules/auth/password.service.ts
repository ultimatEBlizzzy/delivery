import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { AppConfig } from '../../config';

/** Argon2id password hashing (memory-hard; OWASP-recommended parameters, configurable). */
@Injectable()
export class PasswordService {
  private readonly options: argon2.Options & { raw?: false };
  private dummyHash: Promise<string> | null = null;

  constructor(config: ConfigService<AppConfig, true>) {
    const { argon2: params } = config.get('auth', { infer: true });
    this.options = {
      type: argon2.argon2id,
      memoryCost: params.memoryCost,
      timeCost: params.timeCost,
      parallelism: params.parallelism,
    };
  }

  hash(password: string): Promise<string> {
    return argon2.hash(password, this.options);
  }

  async verify(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }

  needsRehash(hash: string): boolean {
    try {
      return argon2.needsRehash(hash, this.options);
    } catch {
      return true;
    }
  }

  /**
   * Burns the same CPU time as a real verification. Called when the email is unknown so that
   * response timing does not reveal which emails are registered.
   */
  async verifyAgainstDummy(password: string): Promise<void> {
    this.dummyHash ??= this.hash('dummy-password-for-timing-equalisation');
    await this.verify(await this.dummyHash, password);
  }
}
