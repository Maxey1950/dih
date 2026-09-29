import argon2 from 'argon2';

/**
 * Password hashing with argon2id (node-argon2).
 *
 * Parameters follow the OWASP Password Storage Cheat Sheet's first argon2id
 * option (m=19 MiB, t=2, p=1). Hashes are stored as PHC strings, which embed
 * their parameters, so they can be raised later; `needsRehash` upgrades a
 * user's hash on their next successful login.
 */
const OPTIONS = { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, OPTIONS);
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    // Malformed hash etc. Never surface hashing internals to the caller.
    return false;
  }
}

export function needsRehash(hash: string): boolean {
  try {
    return argon2.needsRehash(hash, OPTIONS);
  } catch {
    return true;
  }
}

/**
 * Verifying against this when the username does not exist makes "unknown
 * user" take about as long as "wrong password", so response timing does not
 * reveal which usernames are registered.
 */
let dummyHash: Promise<string> | undefined;
export async function burnPasswordCheck(password: string): Promise<void> {
  dummyHash ??= hashPassword('dummy-password-for-timing-equalization');
  await verifyPassword(await dummyHash, password);
}
