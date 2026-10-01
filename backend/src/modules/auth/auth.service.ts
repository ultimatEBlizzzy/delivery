import {
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager, IsNull, LessThan, QueryFailedError, Repository } from 'typeorm';
import { AuthUserDto, Role } from '@hardware-delivery/shared';
import { AppConfig } from '../../config';
import { AuditService } from '../audit/audit.service';
import { Customer } from '../customers/entities/customer.entity';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { RefreshToken } from './entities/refresh-token.entity';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { RegisterDto } from './dto/register.dto';

export interface RequestMeta {
  ip?: string;
  userAgent?: string;
}

export interface AuthResult {
  user: AuthUserDto;
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
}

const INVALID_CREDENTIALS = 'Incorrect email or password';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly settings: AppConfig['auth'];

  constructor(
    config: ConfigService<AppConfig, true>,
    private readonly dataSource: DataSource,
    private readonly users: UsersService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
    @InjectRepository(RefreshToken) private readonly refreshTokens: Repository<RefreshToken>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {
    this.settings = config.get('auth', { infer: true });
  }

  // ---------------------------------------------------------------------------------------------
  // Registration
  // ---------------------------------------------------------------------------------------------

  /** Self-service customer registration. */
  async registerCustomer(dto: RegisterDto, meta: RequestMeta): Promise<AuthResult> {
    const user = await this.createAccount(dto, [Role.CUSTOMER], async (manager, created) => {
      await manager.getRepository(Customer).insert({ userId: created.id });
    });
    return this.issueSession(user.id, meta);
  }

  /**
   * Creates a user with the given roles inside one transaction. `afterCreate` lets role-specific
   * modules (driver, store) attach their profile rows atomically.
   */
  async createAccount(
    dto: Pick<RegisterDto, 'email' | 'password' | 'firstName' | 'lastName' | 'phone'>,
    roles: Role[],
    afterCreate?: (manager: EntityManager, user: User) => Promise<void>,
  ): Promise<User> {
    if (await this.users.emailExists(dto.email)) {
      throw new ConflictException('An account with this email already exists');
    }
    const passwordHash = await this.passwords.hash(dto.password);
    try {
      return await this.dataSource.transaction(async (manager) => {
        const user = await this.users.create(
          {
            email: dto.email,
            passwordHash,
            firstName: dto.firstName,
            lastName: dto.lastName,
            phone: dto.phone ?? null,
            roles,
          },
          manager,
        );
        if (afterCreate) await afterCreate(manager, user);
        return user;
      });
    } catch (err) {
      if (
        err instanceof QueryFailedError &&
        (err.driverError as { code?: string }).code === '23505'
      ) {
        throw new ConflictException('An account with this email already exists');
      }
      throw err;
    }
  }

  // ---------------------------------------------------------------------------------------------
  // Login / refresh / logout
  // ---------------------------------------------------------------------------------------------

  async login(email: string, password: string, meta: RequestMeta): Promise<AuthResult> {
    const user = await this.users.findByEmailWithPassword(email);
    if (!user) {
      await this.passwords.verifyAgainstDummy(password); // equalise timing: don't reveal unknown emails
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    const now = new Date();
    if (user.lockedUntil && user.lockedUntil > now) {
      const minutes = Math.ceil((user.lockedUntil.getTime() - now.getTime()) / 60000);
      throw new HttpException(
        `Too many failed sign-in attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const valid = await this.passwords.verify(user.passwordHash, password);
    if (!valid) {
      await this.registerFailedLogin(user);
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    if (!user.isActive)
      throw new ForbiddenException('This account has been deactivated. Please contact support.');

    const update: Partial<User> = { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: now };
    if (this.passwords.needsRehash(user.passwordHash))
      update.passwordHash = await this.passwords.hash(password);
    await this.userRepo.update({ id: user.id }, update);

    return this.issueSession(user.id, meta);
  }

  private async registerFailedLogin(user: User): Promise<void> {
    const result = await this.userRepo
      .createQueryBuilder()
      .update(User)
      .set({ failedLoginAttempts: () => '"failed_login_attempts" + 1' })
      .where('id = :id', { id: user.id })
      .returning('failed_login_attempts')
      .execute();
    const attempts =
      (result.raw as Array<{ failed_login_attempts: number }>)[0]?.failed_login_attempts ?? 0;
    if (attempts >= this.settings.maxFailedLogins) {
      const lockedUntil = new Date(Date.now() + this.settings.lockoutMinutes * 60_000);
      await this.userRepo.update({ id: user.id }, { failedLoginAttempts: 0, lockedUntil });
      this.logger.warn(
        `Account ${user.id} locked until ${lockedUntil.toISOString()} after repeated failures`,
      );
      await this.audit.record({
        action: 'auth.account_locked',
        entityType: 'user',
        entityId: user.id,
        metadata: { lockedUntil: lockedUntil.toISOString() },
      });
    }
  }

  /**
   * Rotates a refresh token. Presenting a token that was already rotated (outside a short grace
   * window for racing tabs) is treated as theft: the whole token family is revoked.
   */
  async refresh(rawToken: string, meta: RequestMeta): Promise<AuthResult> {
    const existing = await this.refreshTokens.findOne({
      where: { tokenHash: this.tokens.hashRefreshToken(rawToken) },
    });
    if (!existing) throw new UnauthorizedException('Invalid session. Please sign in again.');

    const now = new Date();
    if (existing.expiresAt <= now)
      throw new UnauthorizedException('Session expired. Please sign in again.');

    if (existing.revokedAt) {
      const graceMs = this.settings.refreshReuseGraceSeconds * 1000;
      const withinGrace =
        existing.revokedReason === 'rotated' &&
        now.getTime() - existing.revokedAt.getTime() <= graceMs;
      if (!withinGrace) {
        if (existing.revokedReason === 'rotated') {
          this.logger.warn(
            `Refresh token reuse detected for user ${existing.userId}; revoking family`,
          );
          await this.revokeFamily(existing.familyId, 'reuse_detected');
        }
        throw new UnauthorizedException('Invalid session. Please sign in again.');
      }
    } else {
      // Conditional update: if a concurrent request rotated it first, this is a no-op.
      await this.refreshTokens.update(
        { id: existing.id, revokedAt: IsNull() },
        { revokedAt: now, revokedReason: 'rotated' },
      );
    }

    const authUser = await this.users.findAuthUser(existing.userId);
    if (!authUser) {
      await this.revokeFamily(existing.familyId, 'user_disabled');
      throw new UnauthorizedException('Account not found or disabled');
    }
    return this.issueSession(existing.userId, meta, existing.familyId);
  }

  async logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) return;
    await this.refreshTokens.update(
      { tokenHash: this.tokens.hashRefreshToken(rawToken), revokedAt: IsNull() },
      { revokedAt: new Date(), revokedReason: 'logout' },
    );
  }

  async logoutAll(userId: string): Promise<void> {
    await this.refreshTokens.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: new Date(), revokedReason: 'logout_all' },
    );
  }

  private async revokeFamily(familyId: string, reason: string): Promise<void> {
    await this.refreshTokens.update(
      { familyId, revokedAt: IsNull() },
      { revokedAt: new Date(), revokedReason: reason },
    );
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.users.findByIdWithPassword(userId);
    if (!user || !(await this.passwords.verify(user.passwordHash, currentPassword))) {
      throw new UnauthorizedException('Your current password is incorrect');
    }
    if (currentPassword === newPassword) {
      throw new ConflictException('Choose a new password that is different from the current one');
    }
    await this.userRepo.update(
      { id: userId },
      { passwordHash: await this.passwords.hash(newPassword) },
    );
    await this.logoutAll(userId); // sign out every device
    await this.audit.record({
      action: 'auth.password_changed',
      entityType: 'user',
      entityId: userId,
    });
  }

  // ---------------------------------------------------------------------------------------------
  // Sessions
  // ---------------------------------------------------------------------------------------------

  /** Creates a refresh token row + access token for a user (new family unless one is supplied). */
  async issueSession(userId: string, meta: RequestMeta, familyId?: string): Promise<AuthResult> {
    const user = await this.users.getByIdOrFail(userId);
    const refresh = this.tokens.generateRefreshToken();
    await this.refreshTokens.insert({
      userId,
      familyId: familyId ?? randomUUID(),
      tokenHash: refresh.hash,
      expiresAt: new Date(Date.now() + this.settings.refreshTtlSeconds * 1000),
      userAgent: meta.userAgent?.slice(0, 255) ?? null,
      ip: meta.ip?.slice(0, 64) ?? null,
    });
    const access = await this.tokens.signAccessToken({
      id: user.id,
      email: user.email,
      roles: user.roles.map((r) => r.name),
    });
    return {
      user: await this.getUserDto(user.id),
      accessToken: access.token,
      expiresIn: access.expiresIn,
      refreshToken: refresh.token,
    };
  }

  /** The current user with role-specific context (store memberships, driver profile…). */
  async getUserDto(userId: string): Promise<AuthUserDto> {
    const user = await this.users.getByIdOrFail(userId);
    return this.users.toDto(user);
  }

  /** Housekeeping: remove refresh tokens that expired more than 7 days ago. */
  async purgeExpiredTokens(): Promise<number> {
    const cutoff = new Date(Date.now() - 7 * 86_400_000);
    const result = await this.refreshTokens.delete({ expiresAt: LessThan(cutoff) });
    return result.affected ?? 0;
  }
}
