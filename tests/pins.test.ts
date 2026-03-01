import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('version pinning', () => {
  it('package.json has no ^ or ~ version specifiers', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf-8'));
    const allDeps: Record<string, string> = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
    };
    for (const [name, version] of Object.entries(allDeps)) {
      expect(version, `${name} has unpinned version: ${version}`).not.toMatch(/^[\^~]/);
    }
  });

  it('pnpm lockfile is in sync', () => {
    execSync('pnpm install --frozen-lockfile', { stdio: 'pipe' });
  });
});
