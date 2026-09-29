/**
 * Central input rules for accounts. Used by the API for validation; the web
 * UI mirrors the limits in its forms. Change them here only.
 *
 * Username
 *   - 3 to 20 characters
 *   - ASCII letters, digits and underscore only (so no control characters,
 *     whitespace, homoglyphs or Unicode normalization issues)
 *   - must start and end with a letter or digit
 *   - at most one underscore
 *   - uniqueness is case-insensitive: "Builderman" and "builderman" collide
 *   - a few reserved names are refused
 *
 * Password
 *   - 8 to 128 characters (checked before hashing, so huge inputs cannot be
 *     used to burn CPU in argon2)
 *   - must not equal the username (case-insensitive)
 *   - no composition rules (per NIST SP 800-63B)
 *
 * Display name: 1 to 32 characters after trimming, no control characters.
 * Description: up to 1000 characters; control characters other than newline
 * and tab are removed.
 */
import { z } from 'zod';

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;
export const DISPLAY_NAME_MAX = 32;
export const DESCRIPTION_MAX = 1000;

const USERNAME_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9]|_(?!.*_))*[A-Za-z0-9]$/;
export const RESERVED_USERNAMES = new Set(['admin', 'administrator', 'moderator', 'system', 'support', 'root', 'staff', 'official']);
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/;
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS_EXCEPT_NEWLINE_TAB = /[\u0000-\u0008\u000b-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/g;

export function normalizeUsername(username: string): string {
  return username.toLowerCase();
}

export const Username = z
  .string({ error: 'Username is required' })
  .trim()
  .min(USERNAME_MIN, `Username must be at least ${USERNAME_MIN} characters`)
  .max(USERNAME_MAX, `Username must be at most ${USERNAME_MAX} characters`)
  .regex(
    USERNAME_PATTERN,
    'Username may contain letters, numbers and one underscore, and must start and end with a letter or number'
  )
  .refine((u) => !RESERVED_USERNAMES.has(normalizeUsername(u)), 'This username is not available');

export const Password = z
  .string({ error: 'Password is required' })
  .min(PASSWORD_MIN, `Password must be at least ${PASSWORD_MIN} characters`)
  .max(PASSWORD_MAX, `Password must be at most ${PASSWORD_MAX} characters`);

export const RegisterRequest = z
  .object({ username: Username, password: Password })
  .strict()
  .refine((v) => normalizeUsername(v.password) !== normalizeUsername(v.username), {
    message: 'Password must not be the same as your username',
    path: ['password'],
  });
export type RegisterRequest = z.infer<typeof RegisterRequest>;

/** Login does not apply registration rules (so old or odd names still get a generic error). */
export const LoginRequest = z
  .object({
    username: z.string().trim().min(1).max(64),
    password: z.string().min(1).max(PASSWORD_MAX),
  })
  .strict();
export type LoginRequest = z.infer<typeof LoginRequest>;

export const DisplayName = z
  .string()
  .trim()
  .min(1, 'Display name cannot be empty')
  .max(DISPLAY_NAME_MAX, `Display name must be at most ${DISPLAY_NAME_MAX} characters`)
  .refine((v) => !CONTROL_CHARS.test(v), 'Display name contains invalid characters');

export const Description = z
  .string()
  .max(DESCRIPTION_MAX, `Description must be at most ${DESCRIPTION_MAX} characters`)
  .transform((v) => v.replace(CONTROL_CHARS_EXCEPT_NEWLINE_TAB, '').trim());
