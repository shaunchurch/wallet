---
phase: 02-cryptographic-foundation
plan: 02
subsystem: crypto
tags: [pbkdf2, aes-256-gcm, web-crypto-api, vault-encryption, lockout]

requires:
  - phase: 02-cryptographic-foundation/01
    provides: "VaultBlob/VaultPlaintext types, noble/scure crypto deps"
provides:
  - "encryptVault() -- PBKDF2 + AES-256-GCM vault encryption via Web Crypto API"
  - "decryptVault() -- versioned blob decryption with clean error on wrong password"
  - "createLockoutManager() -- progressive lockout after 3 failed attempts"
affects: [03-wallet-lifecycle, 02-03-key-isolation]

tech-stack:
  added: []
  patterns: ["Web Crypto API for PBKDF2 + AES-GCM", "versioned vault blob schema", "NFKD password normalization", "factory function lockout manager with serialize/restore"]

key-files:
  created:
    - src/features/wallet/crypto/vault.ts
    - tests/crypto/vault.test.ts
  modified:
    - src/features/wallet/types.ts

key-decisions:
  - "BufferSource cast for Web Crypto API compatibility with TS strict Uint8Array typing"
  - "'as number' cast for noUncheckedIndexedAccess on const tuple index (biome-compatible pattern)"

patterns-established:
  - "Web Crypto vault pattern: deriveKey(PBKDF2) -> encrypt/decrypt(AES-GCM) with hex-encoded blob"
  - "Lockout factory: createLockoutManager(savedState?) with serialize() for session persistence"

requirements-completed: [SEC-05, TEST-02]

duration: 3min
completed: 2026-03-01
---

# Phase 2 Plan 2: Vault Encryption Summary

**PBKDF2 (600k iterations) + AES-256-GCM vault encryption via Web Crypto API with versioned blob schema and progressive lockout**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-01T13:44:48Z
- **Completed:** 2026-03-01T13:47:22Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Vault encrypt/decrypt with NFKD-normalized passwords via native Web Crypto API
- Round-trip correctness proven for 10 edge-case passwords (empty, emoji, CJK, 1000+ chars, null byte, Cyrillic)
- Progressive lockout manager with serialize/restore for SW persistence
- Versioned blob schema enables future KDF migration without breaking existing vaults

## Task Commits

1. **Task 1: Implement vault encryption module** - `e48556c` (feat)
2. **Task 2: Vault round-trip tests with edge-case passwords** - `b232c9c` (test)

## Files Created/Modified
- `src/features/wallet/crypto/vault.ts` - PBKDF2 + AES-256-GCM encrypt/decrypt + lockout manager
- `tests/crypto/vault.test.ts` - 20 tests: round-trip, wrong password, blob structure, salt/IV uniqueness, lockout
- `src/features/wallet/types.ts` - Added LockoutState and LockoutManager interfaces

## Decisions Made
- BufferSource cast needed for Web Crypto API calls due to TS strict Uint8Array<ArrayBufferLike> incompatibility
- 'as number' cast on const tuple index access (noUncheckedIndexedAccess + biome lint compliance)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed @noble/hashes import path**
- **Found during:** Task 1 (vault module)
- **Issue:** Import from `@noble/hashes/utils` failed -- subpath exports require `.js` extension
- **Fix:** Changed to `@noble/hashes/utils.js` (matching pattern from 02-01)
- **Files modified:** src/features/wallet/crypto/vault.ts
- **Verification:** pnpm typecheck passes
- **Committed in:** e48556c

**2. [Rule 3 - Blocking] Fixed Uint8Array BufferSource type incompatibility**
- **Found during:** Task 1 (vault module)
- **Issue:** TS strict mode treats Uint8Array<ArrayBufferLike> as incompatible with BufferSource
- **Fix:** Added `as BufferSource` casts on salt, iv, and ciphertext passed to crypto.subtle
- **Files modified:** src/features/wallet/crypto/vault.ts
- **Verification:** pnpm typecheck passes
- **Committed in:** e48556c

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes required for TypeScript compilation. No scope creep.

## Issues Encountered
None beyond the auto-fixed type issues above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Vault encryption ready for key isolation (02-03)
- encryptVault/decryptVault can be wired into background service worker message handlers
- LockoutManager ready for chrome.storage.session persistence

---
*Phase: 02-cryptographic-foundation*
*Completed: 2026-03-01*
