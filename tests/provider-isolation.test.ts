// Provider isolation (TEST-05): verify no key material in dapp-facing code

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(__dirname, '../src');

const KEY_MATERIAL_PATTERNS = [/privateKey/i, /secretKey/i, /\bmnemonic\b/, /\bseed\b/i];

/** Strip single-line // comments and multi-line comments from source */
function stripComments(src: string): string {
  return src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

describe('Provider isolation (TEST-05)', () => {
  it('dapp types contain no key material fields', () => {
    const src = stripComments(readFileSync(resolve(SRC, 'features/dapp/types.ts'), 'utf-8'));
    for (const pattern of KEY_MATERIAL_PATTERNS) {
      expect(src).not.toMatch(pattern);
    }
  });

  it('content script relay contains no key material', () => {
    const src = readFileSync(resolve(SRC, 'entrypoints/content.ts'), 'utf-8');
    for (const pattern of KEY_MATERIAL_PATTERNS) {
      expect(src).not.toMatch(pattern);
    }
  });

  it('inpage provider contains no key material', () => {
    const src = readFileSync(resolve(SRC, 'entrypoints/inpage.ts'), 'utf-8');
    for (const pattern of KEY_MATERIAL_PATTERNS) {
      expect(src).not.toMatch(pattern);
    }
  });

  it('inpage provider does not expose internal state properties', () => {
    const src = readFileSync(resolve(SRC, 'entrypoints/inpage.ts'), 'utf-8');
    expect(src).not.toMatch(/isUnlocked/);
    expect(src).not.toMatch(/selectedAddress/);
    // Provider MUST be frozen
    expect(src).toMatch(/Object\.freeze/);
  });
});
