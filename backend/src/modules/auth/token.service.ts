import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import { Role } from '@hardware-delivery/shared';
import { AppConfig } from '../../config';

export const JWT_ISSUER = 'hardware-delivery';
export const JWT_AUDIENCE = 'hardware-delivery-api';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  roles: Role[];
}

@Injectable()
export class TokenService {
  private readonly accessTtlSeconds: number;

  constructor(
    private readonly jwt: JwtService,
    config: ConfigService<AppConfig, true>,
  ) {
    this.accessTtlSeconds = config.get('auth', { infer: true }).accessTtlSeconds;
  }

  async signAccessToken(user: {
    id: string;
    email: string;
    roles: Role[];
  }): Promise<{ token: string; expiresIn: number }> {
    const payload: AccessTokenPayload = { sub: user.id, email: user.email, roles: user.roles };
    const token = await this.jwt.signAsync(payload);
    return { token, expiresIn: this.accessTtlSeconds };
  }

  /** 48 random bytes (384 bits) – unguessable. Only the hash is persisted. */
  generateRefreshToken(): { token: string; hash: string } {
    const token = randomBytes(48).toString('base64url');
    return { token, hash: this.hashRefreshToken(token) };
  }

  hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
