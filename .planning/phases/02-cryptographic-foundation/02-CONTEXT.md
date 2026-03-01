# Phase 2: Cryptographic Foundation - Context

**Gathered:** 2026-03-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the crypto engine: BIP-39 mnemonic generation, BIP-44 key derivation, AES-256-GCM vault encryption, and key isolation in the background service worker. No UI — pure engine proven by test vectors. Covers SEC-01 through SEC-07, SEC-10, ACCT-01, TEST-01, TEST-02.

</domain>

<decisions>
## Implementation Decisions

### Vault Format & Versioning
- Versioned schema — include version field + KDF params in blob header
- Enables transparent migration to stronger KDFs (Argon2/scrypt) later without breaking existing vaults
- Single seed phrase per vault; multiple accounts derived via BIP-44 index
- Wrong password: progressive delay after 3 failed attempts (5s, 15s, 30s)
- Future format upgrades: auto-migrate on next unlock (seamless, user never prompted)

### Key Module API Surface
- Multi-account derivation from day one — `derive(index)` accepts account index parameter
- Signing deferred to Phase 4 — Phase 2 exposes only generation, derivation, encryption, decryption
- Seed phrase export deferred to Phase 3 — vault never returns raw mnemonic in Phase 2
- Communication: Chrome message passing (`chrome.runtime.sendMessage`) between popup and background
- Key material stays exclusively in background service worker context

### Claude's Discretion
- Crypto library choice (noble-curves/hashes vs ethers.js — user didn't discuss, Claude picks)
- PBKDF2 iteration count (600k floor from requirements, exact tuning is implementation detail)
- Vault JSON schema structure (field names, nesting)
- Test vector selection and test organization
- Error message wording for failed decrypt

</decisions>

<specifics>
## Specific Ideas

No specific references — open to standard approaches. Requirements doc already pins: BIP-39, BIP-44, PBKDF2 600k+, AES-256-GCM, chrome.storage.local/session split.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/entrypoints/background.ts`: Placeholder service worker — crypto module will live here
- Vitest already configured for testing — test vectors can use existing setup
- esbuild multi-bundle pipeline separates background (ESM) from popup/content

### Established Patterns
- Feature-based directory structure: `src/features/wallet/` exists (empty) — crypto module goes here
- Zustand for state management — popup state can react to background messages
- TypeScript strict mode — crypto APIs will be fully typed

### Integration Points
- `src/features/wallet/` — crypto module lives here
- `src/entrypoints/background.ts` — registers message listeners for vault operations
- `chrome.storage.local` — encrypted vault persistence
- `chrome.storage.session` — decrypted key material while unlocked

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-cryptographic-foundation*
*Context gathered: 2026-03-01*
