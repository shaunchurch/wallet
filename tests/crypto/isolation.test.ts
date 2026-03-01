import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC_DIR = path.resolve(__dirname, '../../src');

/** Recursively collect all .ts/.tsx files under a directory. */
function collectFiles(dir: string, exts = ['.ts', '.tsx']): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(full, exts));
    } else if (exts.some((ext) => entry.name.endsWith(ext))) {
      files.push(full);
    }
  }
  return files;
}

describe('key isolation - static analysis', () => {
  it('no privateKey in WalletResponse or DerivedAccount types', () => {
    const typesPath = path.join(SRC_DIR, 'features/wallet/types.ts');
    const content = fs.readFileSync(typesPath, 'utf-8');

    // Extract WalletResponse type block
    const responseMatch = content.match(/export type WalletResponse\s*=[\s\S]*?;/);
    expect(responseMatch).toBeTruthy();
    expect(responseMatch?.[0]).not.toMatch(/privateKey/);

    // Extract DerivedAccount interface
    const derivedMatch = content.match(/export interface DerivedAccount[\s\S]*?\}/);
    expect(derivedMatch).toBeTruthy();
    expect(derivedMatch?.[0]).not.toMatch(/privateKey/);
  });

  it('crypto module not imported outside background.ts and crypto/ internals', () => {
    const allFiles = collectFiles(SRC_DIR);
    const cryptoModulePath = path.normalize('features/wallet/crypto');

    const violations: string[] = [];
    for (const file of allFiles) {
      const rel = path.relative(SRC_DIR, file);
      // Skip background.ts and files inside crypto/ directory
      if (rel === path.normalize('entrypoints/background.ts')) continue;
      if (rel.startsWith(cryptoModulePath)) continue;

      const content = fs.readFileSync(file, 'utf-8');
      // Check for import of wallet/crypto (the barrel or direct submodules)
      if (/wallet\/crypto/.test(content)) {
        violations.push(rel);
      }
    }

    expect(violations).toEqual([]);
  });

  it('no key material in console output', () => {
    const allFiles = collectFiles(SRC_DIR);
    const sensitivePatterns = /\b(mnemonic|privateKey|seed|private)\b/i;
    const consolePattern = /console\.(log|warn|error|info|debug)\s*\(/g;

    const violations: Array<{ file: string; line: number; text: string }> = [];

    for (const file of allFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i] as string;
        if (consolePattern.test(line)) {
          // Reset lastIndex for reuse
          consolePattern.lastIndex = 0;
          // Extract the string argument of the console call
          const argMatch = line.match(/console\.\w+\s*\(\s*['"`]([^'"`]*)['"`]/);
          if (argMatch?.[1] && sensitivePatterns.test(argMatch[1])) {
            violations.push({
              file: path.relative(SRC_DIR, file),
              line: i + 1,
              text: line.trim(),
            });
          }
        }
        // Reset for next iteration
        consolePattern.lastIndex = 0;
      }
    }

    expect(violations).toEqual([]);
  });

  it('messages.ts has zero crypto imports', () => {
    const messagesPath = path.join(SRC_DIR, 'features/wallet/messages.ts');
    const content = fs.readFileSync(messagesPath, 'utf-8');

    // No @scure/* or @noble/* or wallet/crypto imports
    expect(content).not.toMatch(/@scure\//);
    expect(content).not.toMatch(/@noble\//);
    expect(content).not.toMatch(/wallet\/crypto/);

    // Should only have type imports
    const importLines = content.split('\n').filter((l) => l.match(/^import\s/));
    for (const line of importLines) {
      expect(line).toMatch(/^import\s+type\b/);
    }
  });
});
