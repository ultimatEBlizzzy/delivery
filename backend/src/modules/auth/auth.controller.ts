import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { CookieOptions, Request, Response } from 'express';
import { API_PREFIX, AuthResponse } from '@hardware-delivery/shared';
import { Auth } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { StrictThrottle } from '../../common/decorators/strict-throttle.decorator';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { AppConfig } from '../../config';
import { AuthResult, AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  private readonly cookieName: string;
  private readonly cookieOptions: CookieOptions;
  private readonly refreshTtlMs: number;

  constructor(
    private readonly auth: AuthService,
    config: ConfigService<AppConfig, true>,
  ) {
    const settings = config.get('auth', { infer: true });
    this.refreshTtlMs = settings.refreshTtlSeconds * 1000;
    this.cookieName = settings.refreshCookieName;
    this.cookieOptions = {
      httpOnly: true,
      secure: settings.cookieSecure,
      sameSite: settings.cookieSameSite,
      path: `/${API_PREFIX}/auth`, // the cookie is only ever sent to the auth endpoints
    };
  }

  @Public()
  @StrictThrottle()
  @Post('register')
  @ApiOperation({ summary: 'Register a customer account' })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.respond(req, res, await this.auth.registerCustomer(dto, this.meta(req)));
  }

  @Public()
  @StrictThrottle()
  @HttpCode(200)
  @Post('login')
  @ApiOperation({
    summary: 'Sign in with email and password',
    description:
      'Returns a short-lived access token. A rotating refresh token is set as an httpOnly cookie ' +
      '(browsers) or returned in the body when the request header `x-auth-mode: token` is sent.',
  })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.respond(req, res, await this.auth.login(dto.email, dto.password, this.meta(req)));
  }

  @Public()
  @HttpCode(200)
  @Post('refresh')
  @ApiOperation({
    summary: 'Exchange the refresh token for a new access token (rotates the refresh token)',
  })
  async refresh(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { token, fromCookie } = this.extractRefreshToken(req, dto);
    if (!token) throw new UnauthorizedException('No active session');
    if (fromCookie) this.assertCsrfHeader(req);
    try {
      return this.respond(req, res, await this.auth.refresh(token, this.meta(req)));
    } catch (err) {
      if (fromCookie) res.clearCookie(this.cookieName, this.cookieOptions);
      throw err;
    }
  }

  @Public()
  @HttpCode(204)
  @Post('logout')
  @ApiOperation({ summary: 'Revoke the current refresh token and clear the cookie' })
  async logout(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const { token, fromCookie } = this.extractRefreshToken(req, dto);
    if (fromCookie) this.assertCsrfHeader(req);
    await this.auth.logout(token);
    res.clearCookie(this.cookieName, this.cookieOptions);
  }

  @Auth()
  @HttpCode(204)
  @Post('logout-all')
  @ApiOperation({ summary: 'Sign out of every device' })
  async logoutAll(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.logoutAll(user.id);
    res.clearCookie(this.cookieName, this.cookieOptions);
  }

  @Auth()
  @Get('me')
  @ApiOperation({ summary: 'The signed-in user with roles and role-specific context' })
  me(@CurrentUser() user: AuthUser) {
    return this.auth.getUserDto(user.id);
  }

  @Auth()
  @HttpCode(204)
  @Post('change-password')
  @ApiOperation({ summary: 'Change password (signs out all other sessions)' })
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.changePassword(user.id, dto.currentPassword, dto.newPassword);
    res.clearCookie(this.cookieName, this.cookieOptions);
  }

  // ---------------------------------------------------------------------------------------------

  private meta(req: Request) {
    return { ip: req.ip, userAgent: req.header('user-agent') };
  }

  private isTokenMode(req: Request): boolean {
    return req.header('x-auth-mode') === 'token';
  }

  private extractRefreshToken(
    req: Request,
    dto: RefreshDto,
  ): { token?: string; fromCookie: boolean } {
    if (this.isTokenMode(req)) return { token: dto.refreshToken, fromCookie: false };
    const cookie = (req.cookies as Record<string, string> | undefined)?.[this.cookieName];
    return { token: cookie, fromCookie: true };
  }

  /** Cookie-authenticated mutations must carry a custom header (cannot be forged cross-site). */
  private assertCsrfHeader(req: Request): void {
    if (!req.header('x-requested-with')) {
      throw new ForbiddenException('Missing X-Requested-With header');
    }
  }

  private respond(req: Request, res: Response, result: AuthResult): AuthResponse {
    const body: AuthResponse = {
      user: result.user,
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
    };
    if (this.isTokenMode(req)) {
      body.refreshToken = result.refreshToken;
    } else {
      res.cookie(this.cookieName, result.refreshToken, {
        ...this.cookieOptions,
        maxAge: this.refreshTtlMs,
      });
    }
    return body;
  }
}
