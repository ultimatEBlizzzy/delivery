import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AuthUser } from '../interfaces/auth-user.interface';
import { RequestContext } from '../request-context';

/**
 * Global authentication guard: every route requires a valid access token unless it is marked
 * @Public(). Secure-by-default: forgetting a decorator can never expose an endpoint.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }

  handleRequest<TUser = AuthUser>(err: unknown, user: TUser | false): TUser {
    if (err || !user)
      throw err instanceof Error
        ? err
        : new UnauthorizedException('Invalid or expired access token');
    const principal = user as unknown as AuthUser;
    RequestContext.set({
      userId: principal.id,
      userEmail: principal.email,
      roles: principal.roles,
    });
    return user;
  }
}
