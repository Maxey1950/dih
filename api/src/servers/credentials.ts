import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Game-server machine credentials.
 *
 * - Format: "rvgs_" + 32 random bytes as base64url (256 bits of entropy).
 *   The prefix makes leaked credentials easy to spot with secret scanners.
 * - Storage: only SHA-256(credential), hex, in game_servers.credential_hash.
 *   A fast hash is appropriate because the credential is a full-entropy
 *   random value rather than a human password; brute force is infeasible.
 * - Use: `Authorization: Bearer <credential>` on /api/internal/servers/:id/*
 *   only. The credential is bound to one server id; the hash comparison
 *   uses crypto.timingSafeEqual.
 * - It is shown exactly once, by the provisioning CLI, and never returned by
 *   any API endpoint.
 */
export const CREDENTIAL_PREFIX = 'rvgs_';
export const CREDENTIAL_PATTERN = /^rvgs_[A-Za-z0-9_-]{43}$/;

export function generateServerCredential(): string {
  return CREDENTIAL_PREFIX + randomBytes(32).toString('base64url');
}

export function hashServerCredential(credential: string): string {
  return createHash('sha256').update(credential, 'utf8').digest('hex');
}

/** Parse `Authorization: Bearer rvgs_...`. Returns null for anything malformed. */
export function parseServerAuthorization(header: string | undefined): string | null {
  if (typeof header !== 'string') return null;
  const match = /^Bearer (\S+)$/.exec(header);
  if (!match || !CREDENTIAL_PATTERN.test(match[1]!)) return null;
  return match[1]!;
}

export function credentialMatches(credential: string, storedHash: string): boolean {
  const a = Buffer.from(hashServerCredential(credential), 'hex');
  const b = Buffer.from(storedHash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}
