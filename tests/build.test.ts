import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function hashDir(dir: string): string {
  const hash = createHash('sha256');
  const entries = readdirSync(dir).sort();
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      hash.update(hashDir(fullPath));
    } else {
      hash.update(readFileSync(fullPath));
    }
  }
  return hash.digest('hex');
}

describe('deterministic build', () => {
  it('produces identical output for consecutive builds', () => {
    execSync('pnpm build:prod', { stdio: 'pipe' });
    const hash1 = hashDir('dist');
    execSync('pnpm build:prod', { stdio: 'pipe' });
    const hash2 = hashDir('dist');
    expect(hash1).toBe(hash2);
  }, 60_000);
});
