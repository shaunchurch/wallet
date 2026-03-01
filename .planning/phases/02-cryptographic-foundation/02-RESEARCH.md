# Phase 2: Cryptographic Foundation - Research

**Researched:** 2026-03-01
**Domain:** BIP-39/BIP-44 key generation, AES-256-GCM vault encryption, Chrome extension key isolation
**Confidence:** HIGH

## Summary

Phase 2 builds the crypto engine: mnemonic generation, HD key derivation, vault encryption, and key isolation in the background service worker. No UI — pure engine proven by test vectors.

The standard stack is the `@noble/*` / `@scure/*` family (Paul Miller's audited micro-libraries) for BIP-39 mnemonic generation, BIP-32/44 HD derivation, and secp256k1 + keccak256 for Ethereum address derivation. For vault encryption (PBKDF2 + AES-256-GCM), use the **Web Crypto API** (`crypto.subtle`) — it's native, faster than JS implementations, and available in MV3 service workers. `@noble/hashes` does NOT include AES ciphers; it's hashes/KDFs only.

**Primary recommendation:** Use `@scure/bip39` + `@scure/bip32` + `@noble/curves` + `@noble/hashes` for wallet crypto; Web Crypto API (`crypto.subtle`) for vault PBKDF2 + AES-256-GCM. Keep all key material in the background service worker. Prove correctness with official BIP-39 test vectors from Trezor.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Versioned vault schema — include version field + KDF params in blob header
- Enables transparent migration to stronger KDFs (Argon2/scrypt) later without breaking existing vaults
- Single seed phrase per vault; multiple accounts derived via BIP-44 index
- Wrong password: progressive delay after 3 failed attempts (5s, 15s, 30s)
- Future format upgrades: auto-migrate on next unlock (seamless, user never prompted)
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

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SEC-01 | Generate new wallet with BIP-39 seed phrase (12 words default, 24 optional) | `@scure/bip39` `generateMnemonic(wordlist, strength)` — strength 128 for 12 words, 256 for 24. Official test vectors from Trezor repo |
| SEC-02 | User sees seed phrase exactly once during creation with unmissable backup warning | Phase 2 generates mnemonic in background; display is Phase 3 UI. Engine must return mnemonic once during creation flow only |
| SEC-03 | Confirm seed phrase before wallet is usable | Phase 3 UI concern. Engine needs a "finalize" step that only persists vault after confirmation |
| SEC-04 | Import existing wallet via seed phrase entry | `@scure/bip39` `validateMnemonic()` + `mnemonicToSeed()` then derive keys. Same engine path as create |
| SEC-05 | Password encrypts vault via PBKDF2 (600k+ iterations) + AES-256-GCM | Web Crypto API: `crypto.subtle.deriveKey` (PBKDF2) + `crypto.subtle.encrypt` (AES-GCM). 600k iterations minimum per OWASP 2023 |
| SEC-06 | Encrypted vault in chrome.storage.local; decrypted key in chrome.storage.session only while unlocked | chrome.storage.local for vault blob. chrome.storage.session (10MB limit, in-memory, clears on browser restart) for decrypted material |
| SEC-07 | Private keys never leave background service worker — enforced across all code paths | Architecture: crypto module only imported in background.ts. Message passing returns addresses/public data only. Grep-verifiable |
| SEC-10 | No private key material in logs, error reports, messages, or unencrypted storage | Never log key bytes. Error messages reference vault operations, not key values. Grep audit for hex patterns |
| ACCT-01 | Derive primary account via BIP-44 path m/44'/60'/0'/0/0 | `@scure/bip32` `HDKey.fromMasterSeed(seed).derive("m/44'/60'/0'/0/0")`. Then secp256k1 pubkey -> keccak256 -> last 20 bytes -> EIP-55 checksum |
| TEST-01 | Cryptographic correctness validated against published BIP-39/BIP-44/secp256k1 test vectors | Trezor vectors.json (24 vectors for English). BIP-44 test: known seed -> known address. secp256k1: known privkey -> known pubkey |
| TEST-02 | Encryption round-trip test with edge-case passwords | Encrypt/decrypt with: empty string, unicode (emoji, CJK), 1000+ char password, null bytes. Verify plaintext match |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@scure/bip39` | 2.0.1 | BIP-39 mnemonic generation + validation | Audited by Cure53, minimal, same author as noble. Used by MetaMask fork. Zero dependencies beyond noble-hashes |
| `@scure/bip32` | 2.0.1 | BIP-32/44 HD key derivation | Audited by Cure53, 18KB gzipped with all deps. `HDKey.derive()` for path-based derivation |
| `@noble/curves` | 2.0.1 | secp256k1 elliptic curve operations | Audited, minimal. `secp256k1.getPublicKey(privKey)` for pubkey derivation |
| `@noble/hashes` | 2.0.1 | keccak256 for Ethereum address derivation | Audited. Needed for `keccak_256` (Ethereum address = last 20 bytes of keccak256 of uncompressed pubkey) |
| Web Crypto API | Built-in | PBKDF2 key derivation + AES-256-GCM encryption | Native browser API, 5x faster than JS. Available in MV3 service workers via `crypto.subtle` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@noble/hashes/utils` | 2.0.1 | `bytesToHex`, `hexToBytes`, `concatBytes` | Byte array <-> hex conversions throughout crypto module |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @scure/bip39 + @noble/* | ethers.js | ethers.js is 400KB+ bundled, includes RPC/ABI/etc we don't need yet. Noble stack is ~18KB, audited, purpose-built |
| @scure/bip39 + @noble/* | bitcoinjs-lib ecosystem | Heavier, Bitcoin-focused, unnecessary abstractions for Ethereum-only wallet |
| Web Crypto API (AES-GCM) | @noble/ciphers | noble-hashes has NO cipher support. A separate @noble/ciphers package exists but Web Crypto is native and faster |
| Web Crypto API (PBKDF2) | @noble/hashes pbkdf2 | Noble PBKDF2 works but is 5x slower than native. For 600k iterations, native matters — ~200ms native vs ~1s+ JS |

**Installation:**
```bash
pnpm add @scure/bip39@2.0.1 @scure/bip32@2.0.1 @noble/curves@2.0.1 @noble/hashes@2.0.1
```

Note: `@scure/bip32` depends on `@noble/curves` and `@noble/hashes` internally, so they'll be installed as transitive deps regardless. Adding them explicitly ensures direct imports work and pins versions.

## Architecture Patterns

### Recommended Project Structure
```
src/features/wallet/
├── crypto/
│   ├── mnemonic.ts        # BIP-39: generate, validate, toSeed
│   ├── hd.ts              # BIP-44: derive account keys from seed
│   ├── address.ts         # secp256k1 pubkey -> keccak256 -> EIP-55 address
│   └── vault.ts           # PBKDF2 + AES-GCM encrypt/decrypt vault blob
├── types.ts               # VaultBlob, DerivedAccount, KeyPair interfaces
└── messages.ts            # Message type definitions for chrome.runtime
```

### Pattern 1: Vault Blob Schema (Versioned)
**What:** Self-describing encrypted blob with KDF parameters in the header
**When to use:** Every vault persist/load operation

```typescript
// Vault blob stored in chrome.storage.local
interface VaultBlob {
  version: 1;
  kdf: {
    algorithm: 'PBKDF2';
    hash: 'SHA-256';
    iterations: number;    // 600_000+
    salt: string;          // hex-encoded, 16 bytes random
  };
  cipher: {
    algorithm: 'AES-256-GCM';
    iv: string;            // hex-encoded, 12 bytes random
  };
  data: string;            // hex-encoded ciphertext (includes GCM auth tag)
}

// Plaintext before encryption
interface VaultPlaintext {
  mnemonic: string;        // BIP-39 mnemonic phrase
  createdAt: number;       // timestamp
}
```

### Pattern 2: Key Isolation via Message Passing
**What:** Crypto operations ONLY in background service worker. Popup communicates via `chrome.runtime.sendMessage`.
**When to use:** Every interaction between popup and key material

```typescript
// Message types — popup sends these to background
type WalletMessage =
  | { type: 'wallet:create'; password: string; strength?: 128 | 256 }
  | { type: 'wallet:unlock'; password: string }
  | { type: 'wallet:lock' }
  | { type: 'wallet:getAccounts' }
  | { type: 'wallet:deriveAccount'; index: number };

// Response types — background sends these back
type WalletResponse =
  | { type: 'wallet:created'; address: string; mnemonic: string }
  | { type: 'wallet:unlocked'; address: string }
  | { type: 'wallet:locked' }
  | { type: 'wallet:accounts'; accounts: { index: number; address: string }[] }
  | { type: 'wallet:error'; error: string };

// Background listener
chrome.runtime.onMessage.addListener((msg: WalletMessage, _sender, sendResponse) => {
  handleWalletMessage(msg).then(sendResponse);
  return true; // async response
});
```

### Pattern 3: Web Crypto API PBKDF2 + AES-GCM
**What:** Native PBKDF2 key derivation then AES-256-GCM encrypt/decrypt
**When to use:** Vault encryption and decryption
**Source:** MDN SubtleCrypto.deriveKey()

```typescript
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 600_000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encrypt(plaintext: Uint8Array, password: string): Promise<VaultBlob> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plaintext
  );
  return {
    version: 1,
    kdf: { algorithm: 'PBKDF2', hash: 'SHA-256', iterations: 600_000, salt: bytesToHex(salt) },
    cipher: { algorithm: 'AES-256-GCM', iv: bytesToHex(iv) },
    data: bytesToHex(new Uint8Array(ciphertext)),
  };
}
```

### Pattern 4: Ethereum Address from Private Key
**What:** secp256k1 privkey -> uncompressed pubkey -> keccak256 -> last 20 bytes -> EIP-55 checksum
**When to use:** After BIP-44 derivation to get display address

```typescript
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { bytesToHex } from '@noble/hashes/utils.js';

function privateKeyToAddress(privateKey: Uint8Array): string {
  // getPublicKey(priv, false) = 65-byte uncompressed (04 || x || y)
  const pubKey = secp256k1.getPublicKey(privateKey, false);
  // Remove 04 prefix, hash the 64-byte x||y
  const hash = keccak_256(pubKey.slice(1));
  // Last 20 bytes = address
  const addressBytes = hash.slice(-20);
  const addressHex = bytesToHex(addressBytes);
  return toChecksumAddress(addressHex);
}

function toChecksumAddress(address: string): string {
  const lower = address.toLowerCase();
  const hash = bytesToHex(keccak_256(new TextEncoder().encode(lower)));
  let checksummed = '0x';
  for (let i = 0; i < 40; i++) {
    checksummed += parseInt(hash[i], 16) >= 8
      ? lower[i].toUpperCase()
      : lower[i];
  }
  return checksummed;
}
```

### Pattern 5: Progressive Lockout on Wrong Password
**What:** After 3 failed attempts, enforce increasing delays
**When to use:** `wallet:unlock` handler

```typescript
let failedAttempts = 0;
let lockedUntil = 0;

function getDelay(attempts: number): number {
  if (attempts < 3) return 0;
  const delays = [5_000, 15_000, 30_000]; // ms
  return delays[Math.min(attempts - 3, delays.length - 1)];
}

async function handleUnlock(password: string): Promise<WalletResponse> {
  const now = Date.now();
  if (now < lockedUntil) {
    const remaining = Math.ceil((lockedUntil - now) / 1000);
    return { type: 'wallet:error', error: `Too many attempts. Wait ${remaining}s` };
  }
  try {
    const vault = await decryptVault(password);
    failedAttempts = 0;
    // Store decrypted material in session storage
    await chrome.storage.session.set({ decryptedKeys: vault });
    return { type: 'wallet:unlocked', address: vault.accounts[0].address };
  } catch {
    failedAttempts++;
    const delay = getDelay(failedAttempts);
    if (delay > 0) lockedUntil = now + delay;
    return { type: 'wallet:error', error: 'Incorrect password' };
  }
}
```

### Anti-Patterns to Avoid
- **Importing crypto module in popup/content script:** Key material must NEVER exist outside background.ts context. The crypto module files should only be imported in background.ts.
- **Logging key bytes:** Never `console.log` any Uint8Array containing private keys, seeds, or mnemonics. Use placeholder strings in dev logging.
- **Reusing IV:** Each AES-GCM encryption MUST generate a fresh random IV. Reusing IV with same key is catastrophic — leaks plaintext via XOR.
- **Storing mnemonic alongside encrypted vault:** The mnemonic IS the vault plaintext. Don't store it separately.
- **Synchronous PBKDF2 in service worker:** 600k iterations of synchronous PBKDF2 blocks the event loop. Always use `crypto.subtle.deriveKey` (async native).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Mnemonic generation | Custom entropy -> words | `@scure/bip39` `generateMnemonic()` | Checksum calculation, wordlist normalization, entropy validation — edge cases everywhere |
| HD key derivation | Manual HMAC-SHA512 chain | `@scure/bip32` `HDKey.derive()` | Hardened vs normal derivation, child key validation, depth tracking |
| secp256k1 operations | Custom elliptic curve math | `@noble/curves` `secp256k1` | Field arithmetic, constant-time operations, point validation — get any wrong = key leak |
| PBKDF2 | JS loop of HMAC | `crypto.subtle.deriveKey` | 5x slower in JS; native is constant-time and hardware-accelerated |
| AES-GCM | Manual CTR + GHASH | `crypto.subtle.encrypt` | Authentication tag computation, nonce handling — subtle bugs = silent data corruption |
| Hex/bytes conversion | `Buffer.from()` or manual | `@noble/hashes/utils` `bytesToHex`/`hexToBytes` | Consistent, tested, no Node.js Buffer dependency (doesn't exist in service worker) |

**Key insight:** Cryptography is the ONE domain where "just implement it" is always wrong. Every custom implementation is a potential vulnerability. These libraries are audited, battle-tested, and maintained by experts.

## Common Pitfalls

### Pitfall 1: Service Worker Termination Losing State
**What goes wrong:** Service worker is killed after ~30s idle. In-memory variables (failedAttempts, decrypted keys) vanish.
**Why it happens:** MV3 service workers are ephemeral by design.
**How to avoid:** Store lockout state in `chrome.storage.session`. On service worker wake, reload from session storage. Decrypted key material in session storage survives worker restarts but clears on browser close.
**Warning signs:** Wallet appears to "forget" unlock state randomly.

### Pitfall 2: IV Reuse in AES-GCM
**What goes wrong:** Using the same IV twice with the same key leaks the XOR of both plaintexts and breaks authentication.
**Why it happens:** Developer stores a "default IV" or derives IV deterministically.
**How to avoid:** Always `crypto.getRandomValues(new Uint8Array(12))` for each encryption. Store IV alongside ciphertext in vault blob.
**Warning signs:** Tests pass but security audit fails.

### Pitfall 3: Uncompressed vs Compressed Public Key
**What goes wrong:** Using 33-byte compressed pubkey for Ethereum address gives wrong address.
**Why it happens:** `secp256k1.getPublicKey(priv)` defaults to compressed (33 bytes) in noble-curves v2.
**How to avoid:** Explicitly pass `false`: `secp256k1.getPublicKey(priv, false)` for 65-byte uncompressed. Then slice off the `04` prefix byte before keccak256.
**Warning signs:** Derived address doesn't match MetaMask/ethers for same seed phrase.

### Pitfall 4: TextEncoder for Non-ASCII Passwords
**What goes wrong:** Password with unicode characters produces different bytes across implementations.
**Why it happens:** Different normalization forms (NFC vs NFD) for same visual characters.
**How to avoid:** Always normalize password with `password.normalize('NFKD')` before encoding to bytes. This matches BIP-39 passphrase handling.
**Warning signs:** User can't unlock vault after entering visually identical password on different OS.

### Pitfall 5: Buffer vs Uint8Array in Service Worker
**What goes wrong:** Code using Node.js `Buffer` crashes in MV3 service worker.
**Why it happens:** Service workers are web workers — no Node.js APIs available.
**How to avoid:** Use `Uint8Array` everywhere. Noble/scure libraries already return `Uint8Array`. For hex conversion use `@noble/hashes/utils`.
**Warning signs:** Build works, extension crashes at runtime with `Buffer is not defined`.

### Pitfall 6: chrome.storage.session Quota
**What goes wrong:** Storing too much derived key data exceeds 10MB session quota.
**Why it happens:** Developer stores all derived accounts' full key material.
**How to avoid:** Store only what's needed: master seed (64 bytes) + derived private keys (32 bytes each). 10MB is enormous for key material — this is unlikely but worth noting.
**Warning signs:** `chrome.storage.session.set()` rejects with quota error.

### Pitfall 7: Returning Mnemonic After Creation
**What goes wrong:** Mnemonic accessible via message passing after initial creation.
**Why it happens:** No lifecycle gate — `wallet:getMnemonic` message handler exists.
**How to avoid:** Phase 2 has NO message type that returns mnemonic. Only `wallet:create` returns it once. Mnemonic export is Phase 3 behind password re-entry.
**Warning signs:** Grep finds a code path returning mnemonic outside creation flow.

## Code Examples

### BIP-39 Mnemonic Generation
```typescript
// Source: github.com/paulmillr/scure-bip39 README
import { generateMnemonic, validateMnemonic, mnemonicToSeed } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';

// Generate 12-word mnemonic (128-bit entropy)
const mnemonic12 = generateMnemonic(wordlist);       // strength defaults to 128

// Generate 24-word mnemonic (256-bit entropy)
const mnemonic24 = generateMnemonic(wordlist, 256);

// Validate mnemonic
const isValid = validateMnemonic(mnemonic12, wordlist); // true

// Convert mnemonic to 64-byte seed (uses PBKDF2 internally)
const seed = await mnemonicToSeed(mnemonic12);         // Uint8Array(64)
```

### BIP-44 Key Derivation
```typescript
// Source: github.com/paulmillr/scure-bip32 README
import { HDKey } from '@scure/bip32';

const masterKey = HDKey.fromMasterSeed(seed);

// Ethereum primary account: m/44'/60'/0'/0/0
const account0 = masterKey.derive("m/44'/60'/0'/0/0");
const privateKey = account0.privateKey;  // Uint8Array(32)

// Additional accounts: increment last index
const account1 = masterKey.derive("m/44'/60'/0'/0/1");
const account2 = masterKey.derive("m/44'/60'/0'/0/2");
```

### Full: Seed Phrase -> Ethereum Address
```typescript
import { generateMnemonic, mnemonicToSeed } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { HDKey } from '@scure/bip32';
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { bytesToHex } from '@noble/hashes/utils.js';

async function createWallet(strength: 128 | 256 = 128) {
  const mnemonic = generateMnemonic(wordlist, strength);
  const seed = await mnemonicToSeed(mnemonic);
  const master = HDKey.fromMasterSeed(seed);
  const account = master.derive("m/44'/60'/0'/0/0");
  const pubKey = secp256k1.getPublicKey(account.privateKey!, false);
  const hash = keccak_256(pubKey.slice(1));
  const address = toChecksumAddress(bytesToHex(hash.slice(-20)));
  return { mnemonic, address, privateKey: account.privateKey! };
}
```

### Storage Operations
```typescript
// Save encrypted vault to chrome.storage.local
async function saveVault(blob: VaultBlob): Promise<void> {
  await chrome.storage.local.set({ vault: blob });
}

// Load encrypted vault from chrome.storage.local
async function loadVault(): Promise<VaultBlob | null> {
  const result = await chrome.storage.local.get('vault');
  return result.vault ?? null;
}

// Cache decrypted keys in chrome.storage.session (clears on browser close)
async function cacheDecryptedKeys(keys: { seed: string; accounts: DerivedAccount[] }): Promise<void> {
  await chrome.storage.session.set({ keys });
}

// Clear decrypted keys (lock wallet)
async function clearDecryptedKeys(): Promise<void> {
  await chrome.storage.session.remove('keys');
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `bitcoinjs-lib` + `bip39` npm | `@scure/bip39` + `@scure/bip32` | 2022 (Cure53 audit) | Audited, minimal, no prototype pollution risk |
| ethers.js `Wallet.fromMnemonic()` | noble/scure stack direct | 2023+ | ethers.js v6 still works but bundles 400KB+ unnecessary code |
| MetaMask `browser-passworder` (10k PBKDF2 iterations) | Web Crypto API (600k+ iterations) | OWASP 2023 | MetaMask's 10k iterations is dangerously low. 600k is current floor |
| `Buffer` for byte manipulation | `Uint8Array` + noble utils | 2023+ (MV3 era) | Buffer unavailable in service workers |
| `window.crypto` | `crypto` (global in service worker) | MV3 | Service workers use `crypto.subtle` directly, no `window` |

**Deprecated/outdated:**
- `bitcoinjs/bip39` npm package: Unmaintained, security issues. Use `@scure/bip39`
- PBKDF2 with <600k iterations: OWASP 2023 minimum is 600k for SHA-256. MetaMask's 10k is a known weakness
- `ethers.HDNode`: Works but unnecessarily heavy for just key derivation

## Open Questions

1. **mnemonicToSeed vs mnemonicToSeedWebcrypto**
   - What we know: `@scure/bip39` exports `mnemonicToSeedWebcrypto()` which uses Web Crypto API internally for the PBKDF2 step of seed derivation (2048 iterations per BIP-39 spec)
   - What's unclear: Performance difference in practice for just 2048 iterations (minimal). Whether it works reliably in all Chrome extension contexts
   - Recommendation: Use `mnemonicToSeed` (async, JS-based) — 2048 iterations is fast either way. Reserve Web Crypto for the vault's 600k iterations where it matters

2. **Exact PBKDF2 iteration count**
   - What we know: OWASP 2023 says 600k minimum for PBKDF2-SHA256. Some sources suggest 800k+ for 2025/2026
   - What's unclear: Exact performance on low-end hardware at 600k vs 800k
   - Recommendation: Start at 600,000 (matches requirement floor). Store in vault header so it can be bumped without migration. Test unlock time on Chromebook-class hardware — if <500ms, consider bumping to 800k

3. **chrome.storage.session serialization of Uint8Array**
   - What we know: chrome.storage APIs serialize to JSON. Uint8Array becomes a plain object `{0: 1, 1: 2, ...}` when stored
   - What's unclear: Whether this round-trips cleanly
   - Recommendation: Hex-encode all byte arrays before storing in chrome.storage. Decode on read. Small overhead, guaranteed correctness

## Sources

### Primary (HIGH confidence)
- `/paulmillr/noble-hashes` via Context7 — PBKDF2 API, keccak256, sha256, utils imports
- `/paulmillr/noble-curves` via Context7 — secp256k1 API, getPublicKey, keygen
- [github.com/paulmillr/scure-bip39](https://github.com/paulmillr/scure-bip39) — API: generateMnemonic, mnemonicToSeed, validateMnemonic. v2.0.1
- [github.com/paulmillr/scure-bip32](https://github.com/paulmillr/scure-bip32) — API: HDKey.fromMasterSeed, derive, deriveChild. v2.0.1
- [MDN SubtleCrypto.deriveKey()](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/deriveKey) — PBKDF2 + AES-GCM workflow
- [Chrome storage API](https://developer.chrome.com/docs/extensions/reference/api/storage) — session vs local, 10MB quota, setAccessLevel
- [BIP-39 spec](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki) — Algorithm, entropy sizes, PBKDF2 params
- [Trezor test vectors](https://github.com/trezor/python-mnemonic/blob/master/vectors.json) — Official BIP-39 test vectors

### Secondary (MEDIUM confidence)
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) — 600k iterations for PBKDF2-SHA256
- [EIP-55 spec](https://eips.ethereum.org/EIPS/eip-55) — Mixed-case checksum address encoding
- [MetaMask vault architecture](https://www.wispwisp.com/index.php/2020/12/25/how-metamask-stores-your-wallet-secret/) — PBKDF2 + AES-GCM pattern reference (their 10k iterations is outdated)

### Tertiary (LOW confidence)
- Chrome extension security best practices — compiled from multiple search results, no single authoritative source

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified via Context7/official repos, versions confirmed, APIs tested
- Architecture: HIGH — patterns derived from Chrome docs, MDN Web Crypto, and established wallet implementations
- Pitfalls: HIGH — derived from official API constraints (MV3 service worker lifecycle, Web Crypto requirements, BIP-39 spec)

**Research date:** 2026-03-01
**Valid until:** 2026-04-01 (stable domain — crypto standards and Chrome MV3 APIs are mature)
