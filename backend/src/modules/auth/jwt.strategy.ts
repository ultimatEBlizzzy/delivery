import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { AppConfig } from '../../config';
import { UsersService } from '../users/users.service';
import { AccessTokenPayload, JWT_AUDIENCE, JWT_ISSUER } from './token.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService<AppConfig, true>,
    private readonly users: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('auth', { infer: true }).accessSecret,
      algorithms: ['HS256'],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
  }

  /**
   * The token proves identity; roles and account status are re-read from the database on every
   * request so that deactivating a user or changing roles takes effect immediately, not after the
   * access token expires.
   */
  async validate(payload: AccessTokenPayload): Promise<AuthUser> {
    const user = await this.users.findAuthUser(payload.sub);
    if (!user) throw new UnauthorizedException('Account not found or disabled');
    return user;
  }
}
