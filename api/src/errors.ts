import type { ApiError, ApiErrorCode } from '@revival/shared';

export function apiError(code: ApiErrorCode, message: string, details?: unknown): ApiError {
  return { error: details === undefined ? { code, message } : { code, message, details } };
}

/** Expected, client-facing error. Its message is shown to users, so keep it safe. */
export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: ApiErrorCode,
    message: string,
    readonly details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const errors = {
  unauthenticated: () => new AppError(401, 'UNAUTHENTICATED', 'Please log in to continue.'),
  forbidden: (message = 'You do not have permission to do that.') => new AppError(403, 'FORBIDDEN', message),
  notFound: (message = 'Not found') => new AppError(404, 'NOT_FOUND', message),
  conflict: (message: string) => new AppError(409, 'CONFLICT', message),
  badRequest: (message: string) => new AppError(400, 'BAD_REQUEST', message),
  invalidCredentials: () => new AppError(401, 'INVALID_CREDENTIALS', 'Invalid username or password.'),
};
