import type { ApiErrorDetail, ApiErrorResponse } from '@hardware-delivery/shared';

/** Error thrown for every non-2xx API response, carrying the server's structured details. */
export class ApiError extends Error {
  readonly status: number;
  readonly details: ApiErrorDetail[];
  readonly requestId?: string;

  constructor(status: number, body: Partial<ApiErrorResponse> | null, fallbackMessage?: string) {
    super(body?.message || fallbackMessage || `Request failed (${status})`);
    this.name = 'ApiError';
    this.status = status;
    this.details = body?.details ?? [];
    this.requestId = body?.requestId;
  }

  /** field -> first message, for mapping server validation errors onto form fields. */
  get fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const d of this.details) if (d.field && d.messages[0]) out[d.field] = d.messages[0];
    return out;
  }
}

export function getErrorMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  if (error instanceof ApiError) {
    if (error.status === 0) return 'Cannot reach the server. Check your connection and try again.';
    if (error.status >= 500) return 'The server had a problem. Please try again shortly.';
    return error.message;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
