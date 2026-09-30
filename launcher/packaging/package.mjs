#!/usr/bin/env node
/**
 * Assembles launcher/dist/windows-x64/ from an ALREADY BUILT release binary:
 *
 *   cargo build --release --target x86_64-pc-windows-gnu    (in launcher/)
 *   npm run launcher:package
 *
 * Only copies files and writes SHA256SUMS.txt. It does not compile, sign,
 * download or execute anything. dist/ is git-ignored: binaries are never committed.
 */
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const launcherDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const built = join(launcherDir, 'target', 'x86_64-pc-windows-gnu', 'release', 'ourrevival-launcher.exe');
const out = join(launcherDir, 'dist', 'windows-x64');

if (!existsSync(built)) {
  console.error(`Release binary not found: ${built}\nBuild it first: (cd launcher && cargo build --release --target x86_64-pc-windows-gnu)`);
  process.exit(1);
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const files = {
  'RevivalLauncher.exe': built,
  'launcher.example.json': join(launcherDir, 'launcher.example.json'),
  'README.txt': join(launcherDir, 'packaging', 'README.txt'),
};
const sums = [];
for (const [name, src] of Object.entries(files)) {
  copyFileSync(src, join(out, name));
  sums.push(`${createHash('sha256').update(readFileSync(join(out, name))).digest('hex')}  ${name}`);
}
writeFileSync(join(out, 'SHA256SUMS.txt'), sums.join('\n') + '\n');
console.log(`Packaged ${out}\n${sums.join('\n')}\nThis build is UNSIGNED. See docs/launcher-security.md (code signing).`);
