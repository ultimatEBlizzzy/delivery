import { applyDecorators, SetMetadata } from '@nestjs/common';
import { ApiBearerAuth, ApiForbiddenResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { Role } from '@hardware-delivery/shared';

export const ROLES_KEY = 'roles';

/**
 * Declares which roles may call a route. With no roles, any authenticated user may.
 * Enforced by the global RolesGuard; also documents the requirement in Swagger.
 */
export const Auth = (...roles: Role[]) =>
  applyDecorators(
    SetMetadata(ROLES_KEY, roles),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({ description: 'Missing or invalid access token' }),
    ...(roles.length
      ? [ApiForbiddenResponse({ description: `Requires one of the roles: ${roles.join(', ')}` })]
      : []),
  );
