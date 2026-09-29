import type { ApiError, ApiErrorCode } from '@revival/shared';

export function apiError(code: ApiErrorCode, message: string, details?: unknown): ApiError {
  return { error: details === undefined ? { code, message } : { code, message, details } };
}
