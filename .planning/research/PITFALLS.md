# Pitfalls Research

**Domain:** Chrome extension wallet for megaETH L2
**Researched:** 2026-03-01
**Confidence:** HIGH (critical pitfalls verified via official docs + real-world incidents)

## Critical Pitfalls

### Pitfall 1: Service Worker Termination Kills WebSocket State

**What goes wrong:**
Chrome terminates MV3 service workers after 30s idle. All global variables, in-memory caches, and WebSocket connections die. Wallet appears connected but is actually dead. User sees stale balances, transactions fail silently, and dapp requests timeout.

**Why it happens:**
Developers build with persistent background page mental model from MV2. Service worker lifecycle is fundamentally different: it starts, runs, and gets killed constantly. Every global `let ws = new WebSocket(...)` is a ticking timebomb.

**How to avoid:**
- All state in `chrome.storage.local` or IndexedDB, never globals
- WebSocket keepalive: send `eth_chainId` every 25s (megaETH requires activity every 30s)
- Chrome 116+ extends SW lifetime during active WebSocket traffic -- rely on this but also handle reconnection
- Register ALL event listeners synchronously at top-level scope (async registration = missed events after SW restart)
- Use `chrome.alarms` instead of `setTimeout`/`setInterval` (timers die with SW)
- Reconnection with exponential backoff + jitter on every SW activation

**Warning signs:**
- "Works in dev, breaks in prod" -- dev tools keep SW alive
- Balances freeze after 30s of no interaction
- Intermittent "port disconnected" errors in content script communication
- WebSocket `onclose` fires without user action

**Phase to address:**
Phase 1 (core infrastructure). Get the SW lifecycle right before building anything on top. This is the foundation everything else depends on.

---

### Pitfall 2: megaETH Multidimensional Gas Model Breaks Standard Estimation

**What goes wrong:**
Standard Ethereum tools assume 21,000 gas minimum for ETH transfers. megaETH requires 60,000 minimum (21k compute + 39k storage). RPC rejects transactions below 60k. Wallets using hardcoded 21k or naive `eth_estimateGas` results from tools not modified for MegaEVM will produce transactions that fail at submission.

**Why it happens:**
megaETH's gas = compute gas + storage gas. Storage gas applies to zero-to-nonzero SSTORE (20k), account creation (25k), contract creation (32k), code deposit (10k/byte), LOG topics (3,750/topic), calldata (40-160/byte). Standard Ethereum libs (ethers.js, web3.js, even viem) have no concept of storage gas and will underestimate.

**How to avoid:**
- ALWAYS use megaETH RPC `eth_estimateGas` -- never hardcode gas limits
- Set floor of 60,000 gas for all transactions (the protocol minimum)
- Add 10-20% buffer on top of RPC estimates to handle edge cases
- Watch for megaETH hardfork changes (MiniRex, Rex, Rex1, Rex2) that may alter gas model
- Display both compute and storage gas in advanced tx details for transparency
- Test with storage-heavy transactions (token approvals, NFT mints, DEX swaps) not just ETH transfers

**Warning signs:**
- ETH transfers work but token transfers fail
- "intrinsic gas too low" errors from RPC
- Gas estimates match Ethereum values (21k for transfers) -- means megaETH-specific estimation is broken
- Inconsistency between simulated and actual gas costs

**Phase to address:**
Phase 2 (transaction layer). Must be correct before any transaction can succeed. Build gas estimation tests against megaETH testnet from day one.

---

### Pitfall 3: Supply Chain Attack via npm/Chrome Web Store API Key Leak

**What goes wrong:**
Attacker gains access to Chrome Web Store API key or npm maintainer credentials, pushes malicious extension update that exfiltrates seed phrases. This is not theoretical: Trust Wallet lost $8.5M in December 2025 exactly this way. Attacker used leaked GitHub secrets to push v2.68 with seed phrase exfiltration, bypassing manual review.

**Why it happens:**
Wallet extensions are the highest-value target in crypto. A single compromised dependency or leaked credential = access to every user's funds. The npm ecosystem had 18 packages with 2.6B weekly downloads compromised in Sept 2025 via maintainer phishing. Over 20% of 2025 crypto exploits targeted extension layers.

**How to avoid:**
- Exact version pins in package.json (no `^` or `~`), lockfile committed
- Zero-dependency crypto libs only (@noble/@scure) -- already in project constraints
- Chrome Web Store API key: store in hardware security module or split-key signing, never in GitHub secrets
- Reproducible/deterministic builds so anyone can verify published extension matches source
- `npm audit` in CI, automated dependency scanning (Snyk/Socket)
- Minimal dependency tree -- every new package is attack surface
- Separate publish credentials from dev credentials, require 2+ approvals for releases
- Content Security Policy: no `eval`, no `Function()`, no dynamic imports, no remote code
- Monitor `chrome.runtime.getManifest().version` against expected version

**Warning signs:**
- Unexpected version bump in Chrome Web Store
- New network requests to unknown domains in extension traffic
- Dependencies with recent ownership transfers
- `postinstall` scripts in new dependencies
- Sudden spike in download/install count (attacker may auto-install)

**Phase to address:**
Phase 0 (project setup) and every phase thereafter. Security supply chain is a continuous concern. Reproducible builds must be working before first public release.

---

### Pitfall 4: EIP-7702 Authorization Replay and Delegation Hijacking

**What goes wrong:**
EIP-7702 authorization signatures with `chainId = 0` are replayable across ALL chains. Attacker captures one delegation signature, replays it on L1, other L2s, testnets -- anywhere the victim EOA exists. Over 80% of EIP-7702 delegate contracts in the wild exhibit malicious behavior (as of late 2025). Users delegate to malicious contracts and lose all funds.

**Why it happens:**
EIP-7702's authorization tuple allows `chainId = 0` for chain-agnostic delegation. Nonces are per-chain, so the same nonce value exists independently on each chain. The protocol places minimal constraints on what delegate contracts can do. Pre-existing smart contract wallets are vulnerable to front-running attacks on initialization.

**How to avoid:**
- ALWAYS set `chainId` to megaETH's chain ID (4326 mainnet / 6343 testnet) in authorization tuples -- never 0
- Delegate ONLY to audited, well-known contract implementations
- Combine delegation + initialization in a single atomic transaction to prevent front-running
- Use explicit storage layouts (ERC-7201 namespaced storage) to prevent collisions during redelegation
- Display full delegation details to user before signing: target contract, permissions granted, chain scope
- Warn users that delegation grants code execution rights over their EOA
- Implement hot/warm/cold wallet pattern: EIP-7702 on hot wallets only, cold wallets keep no delegation

**Warning signs:**
- User signing delegation without understanding scope
- `chainId = 0` in any authorization tuple
- Delegation to unverified/unaudited contracts
- Storage slot conflicts after redelegation (corrupted state)
- `tx.origin` checks in delegate contract (broken security assumption post-7702)

**Phase to address:**
Phase 3 (advanced features). EIP-7702 is explicitly post-MVP but architecture must accommodate it from Phase 1. Signing interface should be extensible to authorization tuples.

---

### Pitfall 5: Provider Injection Race Conditions and Wallet Conflicts

**What goes wrong:**
Multiple wallet extensions fight over `window.ethereum`. Without EIP-6963, extensions inject in unpredictable order. Dapps detect wrong wallet, user transactions go to wrong provider, or provider is overwritten mid-session. Users with MetaMask + Vibe Wallet installed get inconsistent behavior.

**Why it happens:**
Content scripts inject at `document_start` or `document_idle` with no guaranteed ordering. Legacy dapps check `window.ethereum` directly. Even with EIP-6963 (event-based multi-provider discovery), many dapps still fall back to `window.ethereum`. If Vibe Wallet overwrites it, MetaMask users complain. If it doesn't, dapps don't find it.

**How to avoid:**
- Implement EIP-6963 (Multi Injected Provider Discovery) as primary mechanism
- Also inject `window.ethereum` for legacy dapp compatibility but with proper `isMetaMask` guard
- Use `eip6963:announceProvider` event to register without conflicts
- Set a unique `uuid` and clear `rdns` identifier (e.g., `com.vibewallet`)
- Do NOT set `isMetaMask = true` (some wallets do this for compatibility, it causes confusion)
- Handle the case where dapp only checks `window.ethereum` -- be discoverable but don't fight
- Test with MetaMask, Rabby, Coinbase Wallet, and Phantom all installed simultaneously

**Warning signs:**
- Dapp says "install MetaMask" when Vibe Wallet is installed
- Transactions route to wrong wallet
- `window.ethereum.isMetaMask` returns true from your extension
- User reports "works alone, breaks with other wallets installed"

**Phase to address:**
Phase 2 (dapp connectivity). Must be correct before any dapp integration is usable.

---

### Pitfall 6: Chrome Web Store Review Rejection Loop

**What goes wrong:**
Wallet extension gets rejected or delisted. Broad permissions (`<all_urls>`, `activeTab` on all sites), vague descriptions, or CSP violations trigger automated rejection. Wallet extensions face extra scrutiny due to financial nature. Trust Wallet was temporarily delisted in 2025 after the breach incident.

**Why it happens:**
Chrome Web Store policies are strict and getting stricter. Crypto wallets are high-risk category. Common triggers: requesting more permissions than needed, remote code loading (MV3 bans it), missing privacy policy, obfuscated code, insufficient description of data handling.

**How to avoid:**
- Request absolute minimum permissions. Use `activeTab` scoped to interaction, not `<all_urls>`
- Never use remote code -- all code must be in the extension bundle
- Clear, specific store description: "Vibe Wallet sends and receives ETH on megaETH L2"
- Privacy policy URL in manifest and developer dashboard
- No code obfuscation/minification that hides intent (readable source is fine)
- Declare all data collection in privacy practices tab
- Separate content script permissions from background permissions
- Apply for "Featured" badge early -- adds legitimacy and review priority
- Have appeal process ready: document every permission with justification

**Warning signs:**
- Rejection email citing "broad host permissions" or "unclear functionality"
- Review taking >7 days (normal is 1-3 days; delays signal manual review queue)
- Policy change emails from Chrome Web Store team
- Competitor wallet delisted (signals category-wide scrutiny)

**Phase to address:**
Phase 1 (first submission). Submit a minimal working version early to validate Store acceptance. Don't build for months then discover Store rejects the approach.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcoded gas limits (60k) | Quick ETH transfers | Breaks on contract interactions; fails when megaETH updates gas model | Never -- always use RPC estimation |
| `window.ethereum` without EIP-6963 | Works with legacy dapps | Conflicts with every other wallet, user complaints | Phase 1 only, must add EIP-6963 in Phase 2 |
| Storing encrypted keys in `chrome.storage.sync` | Cross-device sync | 100KB limit, 8KB per item, write rate limits (120/min), Google has access | Never for keys -- local only |
| Single WebSocket connection | Simple code | Silent failures, no failover, stale state | Phase 1 prototype only |
| Skip tx simulation | Faster UX | Users approve malicious transactions, drain exploits | Never for mainnet |
| Bundling all contexts together | Faster builds | CSP violations, security boundary confusion, content script bloat | Never -- separate bundles per context |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| megaETH Realtime API | Assuming WebSocket stays alive forever | Send `eth_chainId` keepalive every 25s; handle reconnection on every SW activation |
| megaETH `realtime_sendRawTransaction` | Not handling the 10s timeout | Implement fallback: if realtime times out, poll for receipt via `eth_getTransactionReceipt` |
| megaETH `stateChanges` subscription | Subscribing to too many addresses | Subscribe only to active account + watched tokens; resubscribe on address change |
| megaETH gas estimation | Using Ethereum-standard tools without modification | Use megaETH RPC directly; floor at 60k; account for storage gas in fee display |
| EIP-1193 provider | Returning chainId as decimal string | Return hex string (`"0x10E6"` for mainnet 4326, `"0x18C7"` for testnet 6343) |
| Content script ↔ Background | Using `chrome.runtime.sendMessage` for everything | Use long-lived `chrome.runtime.connect` ports for streaming data; sendMessage for one-shot requests |
| Token list (mega-tokenlist) | Fetching on every popup open | Cache with TTL in `chrome.storage.local`; refresh in background on alarm |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Polling RPC instead of using WebSocket subscriptions | High RPC costs, stale data, battery drain | Use `stateChanges` subscription for balance updates, `logs` for token events | Immediately on megaETH (10ms blocks = polling is absurd) |
| Storing full tx history in `chrome.storage.local` | Popup load time increases, storage quota (10MB) hit | Store last N transactions locally, paginate from block explorer API | ~500-1000 transactions |
| Re-rendering popup on every WebSocket message | UI jank, frozen popup | Debounce/throttle balance updates (100-250ms); batch state updates | Immediately on megaETH (100+ blocks/sec) |
| Serializing entire state on every storage write | SW hangs, missed events, 5-minute timeout | Write only changed fields; use `chrome.storage.local.set({ key: value })` not full state dumps | ~100 active tokens/accounts |
| Decrypting vault on every background activation | SW startup latency, poor UX | Keep decrypted key in `chrome.storage.session` (memory-only, cleared on restart); re-derive only after browser restart | Immediately noticeable with frequent SW termination |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Seed phrase in `chrome.storage.sync` | Google servers have your keys; sync quota exposes structure | Use `chrome.storage.local` only; encrypt with AES-256-GCM + PBKDF2 (600k+ iterations) |
| Password-derived key cached in global variable | Lost on SW termination; if not properly cleared, extractable from memory dump | Use `chrome.storage.session` for session key; clear on lock; never persist derived key to disk |
| Using `crypto.subtle` for key derivation | Implementation varies by browser; no audit trail | Use `@noble/hashes` for PBKDF2, `@noble/ciphers` for AES-GCM (audited, deterministic, tested) |
| Content script accessing key material | Any page script could exploit XSS to reach content script | Key operations ONLY in background SW; content script is a dumb message proxy |
| Missing nonce in AES-GCM encryption | Nonce reuse = catastrophic plaintext recovery | Generate unique 12-byte nonce per encryption; store nonce alongside ciphertext |
| No auto-lock timeout | Unattended browser = unlocked wallet | Auto-lock after 5-15min idle; clear session key; require password to re-enter |
| Displaying seed phrase in popup DOM | Screenshot malware, shoulder surfing, DOM inspection | Show only during explicit backup flow; clear from DOM immediately; warn user |
| Trusting `eth_sign` requests from dapps | Dapp can get signature over arbitrary data = account drain | Reject `eth_sign` entirely or show raw hex with extreme warning; prefer `personal_sign` / `eth_signTypedData_v4` |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Showing "pending" for 10ms block confirmations | Confusing -- tx is already preconfirmed | Show preconfirmed immediately with subtle "finalizing" indicator; update to confirmed/settled |
| Using Ethereum-style gas fee display | Users see gas in gwei but megaETH fees are fractions of a cent | Show total fee in USD equivalent; hide gwei details behind "Advanced" |
| No finality explanation | Users don't understand preconfirmed vs confirmed vs L1 settled | Three-stage visual indicator; tooltip explaining each level |
| Popup takes >500ms to open | Users double-click, open multiple instances, assume broken | Pre-render popup shell; load account data async; show skeleton UI instantly |
| Blocking popup on RPC calls | Popup freezes while fetching | All RPC in background SW; popup renders from cached state; updates stream in |
| Raw error messages from RPC | "intrinsic gas too low" means nothing to users | Map known errors to human-readable messages: "Transaction fee too low for megaETH network" |

## "Looks Done But Isn't" Checklist

- [ ] **Key encryption:** Often missing PBKDF2 iteration count bump -- verify >= 600,000 iterations
- [ ] **Service worker reconnection:** Works once but doesn't handle SW restart mid-session -- verify by killing SW in devtools
- [ ] **Gas estimation:** Works for ETH transfers but not for contract calls -- test with ERC-20 approve + transfer
- [ ] **Provider injection:** Works alone but not with MetaMask installed -- test with 3+ wallets
- [ ] **WebSocket keepalive:** Sends keepalive but doesn't detect failed pong -- verify with network disconnection test
- [ ] **Transaction history:** Shows sent txs but not received -- verify incoming ETH and token transfers both appear
- [ ] **Auto-lock:** Timer resets on popup interaction but not on dapp interaction -- verify lock triggers even during active dapp session
- [ ] **Chain switching:** Returns correct chainId but doesn't emit `chainChanged` event -- verify dapps detect network change
- [ ] **Error handling:** Happy path works but RPC timeout/disconnect shows blank screen -- test with RPC offline
- [ ] **Reproducible build:** Build script works but output hash differs between machines -- verify on clean checkout on different OS

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| SW lifecycle wrong (globals instead of storage) | HIGH | Rewrite state management layer. Every variable access becomes async storage read. Cascading changes everywhere. |
| Gas model hardcoded | MEDIUM | Replace hardcoded values with RPC calls. Add gas estimation service layer. Update tests. |
| Supply chain compromise | CRITICAL | Emergency delisting, user notification, new keys for all affected users, forensic audit, rebuild trust. Trust Wallet example: $8.5M lost, months of reputation damage. |
| EIP-7702 chainId=0 in production | HIGH | Cannot revoke on-chain delegation easily. Must deploy new delegate contract, migrate users, communicate urgently. |
| Store rejection | MEDIUM | Read rejection reason carefully, fix specific policy violation, resubmit. Usually 1-3 day turnaround. Have Firefox/Brave as backup distribution. |
| Provider conflicts | LOW | Add EIP-6963 support. Can be done incrementally without breaking existing functionality. |
| WebSocket drops undetected | MEDIUM | Add health check layer, reconnection manager, stale data indicators. Retroactive but well-scoped. |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| SW termination kills state | Phase 1 (infrastructure) | SW killed in devtools mid-operation; app recovers within 1s |
| Multidimensional gas underestimation | Phase 2 (transactions) | All tx types (ETH, ERC-20, contract) succeed on megaETH testnet |
| Supply chain attack | Phase 0 (setup) + all phases | Reproducible build matches published extension byte-for-byte |
| EIP-7702 replay/hijack | Phase 3 (advanced) | Authorization tuples always include chain-specific chainId; delegation tested on testnet only |
| Provider injection conflicts | Phase 2 (dapp connectivity) | EIP-6963 announces correctly with 3+ wallets installed |
| Chrome Web Store rejection | Phase 1 (first submission) | Minimal extension accepted to Store before building full feature set |
| WebSocket reliability | Phase 1 (infrastructure) | Balance updates resume within 2s after network disconnect/reconnect |
| Key management mistakes | Phase 1 (crypto layer) | Full TDD on encrypt/decrypt/derive; session key cleared on lock |
| CSP violations | Phase 0 (setup) | Strict CSP in manifest; no eval/Function anywhere; verified by automated scan |
| Gas model changes (hardforks) | Phase 2+ (ongoing) | Gas estimation uses RPC only; no hardcoded values; monitor megaETH announcements |

## Sources

- [Chrome Service Worker Lifecycle (official)](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) -- HIGH confidence
- [Chrome Storage API Quotas (official)](https://developer.chrome.com/docs/extensions/reference/api/storage) -- HIGH confidence
- [Chrome MV3 CSP (official)](https://developer.chrome.com/docs/extensions/reference/manifest/content-security-policy) -- HIGH confidence
- [megaETH MegaEVM Docs (official)](https://docs.megaeth.com/megaevm) -- HIGH confidence, 60k minimum confirmed
- [megaETH Realtime API Docs (official)](https://docs.megaeth.com/realtime-api) -- HIGH confidence
- [Trust Wallet $8.5M Supply Chain Attack (Dec 2025)](https://thehackernews.com/2025/12/trust-wallet-chrome-extension-hack.html) -- HIGH confidence
- [npm Supply Chain Attack Sept 2025](https://www.sisainfosec.com/blogs/npm-supply-chain-attack-hits-packages-with-billions-of-weekly-downloads-advisory-by-sisa-sappers/) -- HIGH confidence
- [EIP-6963 Multi-Provider Discovery](https://github.com/ethereum/EIPs/blob/master/EIPS/eip-6963.md) -- HIGH confidence
- [EIP-7702 Attack Surfaces - Nethermind](https://www.nethermind.io/blog/eip-7702-attack-surfaces-what-developers-should-know) -- HIGH confidence
- [EIP-7702 Phishing Attack Analysis (arXiv)](https://arxiv.org/html/2512.12174) -- HIGH confidence
- [EIP-7702 Security - Halborn](https://www.halborn.com/blog/post/eip-7702-security-considerations) -- MEDIUM confidence
- [Browser Extension Fatal Design Flaw - $713M in 2025](https://cryptoslate.com/how-browser-extensions-expose-your-crypto-to-a-fatal-design-flaw-that-the-industry-ignored-bleeding-713m-in-2025/) -- MEDIUM confidence
- [Chrome Web Store Review Process (official)](https://developer.chrome.com/docs/webstore/review-process) -- HIGH confidence
- [WebSocket in Service Workers (official)](https://developer.chrome.com/docs/extensions/how-to/web-platform/websockets) -- HIGH confidence

---
*Pitfalls research for: Chrome extension wallet (megaETH)*
*Researched: 2026-03-01*
