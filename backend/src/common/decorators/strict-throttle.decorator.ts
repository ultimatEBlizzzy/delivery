import { SetMetadata } from '@nestjs/common';

export const STRICT_THROTTLE_KEY = 'strictThrottle';

/**
 * Applies the stricter "strict" rate limit (RATE_LIMIT_AUTH_MAX per window, per IP) on top of the
 * global limit. Used on credential endpoints to slow down brute-force and credential stuffing.
 */
export const StrictThrottle = () => SetMetadata(STRICT_THROTTLE_KEY, true);
