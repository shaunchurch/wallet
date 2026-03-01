# Project Research Summary

**Project:** MegaWallet — Chrome Extension Crypto Wallet
**Domain:** Browser extension wallet (megaETH L2)
**Researched:** 2026-03-01
**Confidence:** HIGH

## Executive Summary

MegaWallet is a Chrome Manifest V3 browser extension wallet purpose-built for megaETH L2. Expert wallets (MetaMask, Rabby, Rainbow) all use the same 4-context architecture: inpage provider → content script relay → background service worker → popup UI. The key engineering insight is that the background service worker is the only trusted context — all key operations, signing, and RPC calls happen there. The recommended approach uses TypeScript + viem + Zustand + esbuild with audited zero-dependency crypto (@noble/@scure), giving a wallet that is auditable, small, and correct.

megaETH's unique capabilities are the entire product justification. Standard wallets are literally broken on megaETH — they hardcode 21k gas (megaETH requires 60k minimum) and poll for balance updates on a chain with 10ms blocks. This creates a clear wedge: the first wallet that handles megaETH's multidimensional gas correctly, uses the `stateChanges` WebSocket subscription for real-time balances, and leverages `realtime_sendRawTransaction` for instant confirmation will feel categorically different from MetaMask.

The critical risks are: (1) MV3 service worker lifecycle is fundamentally different from MV2 background pages — all state must be persisted to chrome.storage, never globals; (2) supply chain attacks against wallet extensions are a live, high-value threat (Trust Wallet lost $8.5M in Dec 2025 via compromised CI credentials); (3) EIP-7702 has significant attack surface and should be deferred to v2 after audits. Build crypto and storage layers first with exhaustive TDD before any UI — these are the foundations that, if wrong, require full rewrites.

## Key Findings

### Recommended Stack

The stack is lean and deliberate. viem 2.x is the clear choice over ethers.js — it's TypeScript-first, tree-shakeable, and has built-in EIP-7702 support. esbuild over webpack/WXT for auditable, deterministic builds with no hidden transforms — critical for a security-sensitive product. Zustand 5 works outside React (background service worker) and has a chrome.storage persist adapter pattern. All cryptography uses @noble/@scure (audited, zero-dependency, same author as viem's crypto internals — no version conflicts).

**Core technologies:**
- TypeScript 5.9.3: type safety for tx serialization, ABI encoding, chain config — prevents fund-losing bugs
- viem 2.46.2: Ethereum interaction, EIP-7702 support, `defineChain` for megaETH config
- React 19.2.4 + Tailwind CSS 4.2.1: popup UI, static CSS (no CSP violations from runtime injection)
- Zustand 5.0.11: state management across SW + popup contexts, chrome.storage persist adapter
- esbuild 0.27.3: separate bundles per context (background ESM, content/inpage IIFE), sub-100ms builds
- @noble/curves + @noble/hashes + @scure/bip39 + @scure/bip32 (all 2.0.1): audited zero-dep crypto
- webext-zustand: cross-context state sync via chrome.runtime ports (MEDIUM confidence — evaluate vs pegasus)

**Pin all versions exactly** (no `^` or `~`). Every new dependency is attack surface.

### Expected Features

The feature set divides cleanly: everything that makes megaETH wallets better than MetaMask on megaETH is a P1 differentiator, not a P2 nice-to-have.

**Must have (table stakes) — wallet is broken without these:**
- Seed phrase create/import (BIP-39/44) with AES-256-GCM vault — root dependency for everything
- Send/receive ETH with megaETH-native gas estimation (60k minimum) — MetaMask fails this
- EIP-1193 + EIP-6963 provider injection — dapps won't find the wallet without both
- Transaction confirmation UI showing gas breakdown — user safety baseline
- Password lock/auto-lock — basic security

**Should have (megaETH differentiators — ship at launch, not v1.x):**
- Real-time balance via `stateChanges` WebSocket — THE killer feature, ~10ms updates vs poll-on-refresh
- Instant tx via `realtime_sendRawTransaction` — receipt in one call, no polling, no spinners
- Finality indicator (preconfirmed → confirmed → L1 settled) — low cost, high trust signal
- Network config for mainnet (4326) + testnet (6343)

**Add post-launch (v1.x after validation):**
- ERC-20 token support, transaction history, tx simulation/balance-change preview
- Bridge deposit detection, multidimensional gas display, network health dashboard

**Defer (v2+):**
- EIP-7702 transaction batching — high value, high complexity, requires security audit
- Hardware wallet (Ledger/Trezor), gas abstraction, session keys

### Architecture Approach

Four isolated execution contexts with strict privilege separation: inpage script (untrusted, page world, window.ethereum only) → content script (low trust, message relay + validation) → background service worker (high trust, all crypto + RPC + WebSocket) → popup UI (high trust display layer, no direct crypto). Private keys exist only in the SW, only as Uint8Array, only during signing. Tiered storage: chrome.storage.local for encrypted vault, chrome.storage.session for session key (survives SW restart, clears on browser close), in-memory only for decrypted keys during signing.

**Major components:**
1. **Inpage Script** — EIP-1193 provider, EIP-6963 announcer; injected into page world via `"world": "MAIN"`
2. **Content Script** — schema validation, rate limiting, message relay; isolated world, zero key access
3. **Background Service Worker** — keyring, transaction, network, permission, wallet controllers; WebSocket manager; all signing
4. **WebSocketManager** — megaETH stateChanges subscription, 20s keepalive (eth_chainId), exponential backoff reconnect, subscription persistence across SW restarts
5. **Popup UI** — React app, reads from Zustand store synced from SW, zero crypto logic
6. **Crypto module** — pure functions, @noble/@scure only, imported exclusively by background

Build order follows dependency graph: shared types → crypto module → SW controllers → provider + content script → popup UI → megaETH realtime features → advanced (EIP-7702, simulation).

### Critical Pitfalls

1. **SW termination kills WebSocket state** — Never use globals; all state to chrome.storage. Send eth_chainId keepalive every 20s (satisfies megaETH's 30s + Chrome's idle timer). Persist subscription list to chrome.storage.session; resubscribe on every SW wake. Get this right in Phase 1 or everything above it breaks.

2. **megaETH gas model breaks standard estimation** — 60k minimum gas (21k compute + 39k storage), not Ethereum's 21k. Always use megaETH RPC `eth_estimateGas`; never hardcode or use local EVM simulation. Add 10-20% buffer. Test ETH transfers, ERC-20 approvals, and contract interactions separately — each has different storage gas costs.

3. **Supply chain attack** — Trust Wallet lost $8.5M via compromised Chrome Web Store API key (Dec 2025). Pin all package versions exactly. Store CWS API key in hardware security module, never GitHub secrets. Zero-dep crypto (@noble/@scure) already minimizes attack surface. Reproducible deterministic builds must be verifiable before first public release.

4. **EIP-7702 authorization replay** — chainId=0 authorizations are replayable across all chains. Always set chainId to 4326/6343. Delegate only to audited contracts. Combine delegation + initialization atomically. Defer to v2, but architect signing interface to be extensible now.

5. **Provider injection conflicts** — Must implement EIP-6963 (multi-wallet discovery) as primary; window.ethereum as legacy fallback. Do NOT set isMetaMask=true. Test with MetaMask + Rabby + Coinbase Wallet all installed.

## Implications for Roadmap

Based on research, the dependency graph from ARCHITECTURE.md maps directly to a 5-phase structure:

### Phase 1: Foundation + Security Infrastructure
**Rationale:** Crypto layer and SW lifecycle are root dependencies — everything else depends on them. Getting these wrong requires full rewrites. Supply chain security must be in place before first commit of sensitive code. Chrome Web Store submission of minimal working version validates store acceptance before months of wasted build time.
**Delivers:** Secure vault (AES-256-GCM + PBKDF2 600k+), HD key derivation (BIP-39/44), lock/unlock, deterministic builds, Chrome Web Store entry
**Addresses:** Seed phrase create/import, password lock/auto-lock, network config (table stakes)
**Avoids:** SW lifecycle pitfall (storage-first from day 1), supply chain attack (pinned deps, reproducible builds), Store rejection (minimal submission validates acceptance early)
**Research flag:** Standard patterns — Chrome MV3 docs are comprehensive, @noble/@scure are well-documented. Skip research-phase.

### Phase 2: Transaction Layer + dApp Connectivity
**Rationale:** EIP-1193/6963 provider injection and correct gas estimation are the wedge features — these are where MetaMask fails on megaETH. Must be correct before real-time features are built on top.
**Delivers:** Send/receive ETH with megaETH gas (60k minimum via RPC), EIP-1193 + EIP-6963 provider, transaction confirmation UI with gas breakdown, content script message relay with schema validation
**Uses:** viem publicClient for RPC, esbuild separate bundles (IIFE for content/inpage), webext-zustand for cross-context state
**Implements:** Content script + inpage architecture, RPC router, TransactionController, PermissionController
**Avoids:** Multidimensional gas pitfall, provider injection conflicts
**Research flag:** EIP-6963 implementation details may need deeper research during planning — spec is clear but wallet compatibility matrix is complex.

### Phase 3: megaETH Realtime Features
**Rationale:** These are the differentiators that justify building a new wallet. WebSocket infra is a second root dependency (stateChanges + bridge detection + miniBlocks all share it). Build after transaction layer so there's something to accelerate.
**Delivers:** Real-time balance via stateChanges WebSocket, instant tx via realtime_sendRawTransaction, finality indicator (preconfirmed/confirmed/settled), WebSocketManager with reconnection + keepalive
**Implements:** ws-manager.ts, NetworkController WebSocket path, popup state streaming via chrome.runtime port
**Avoids:** Polling anti-pattern (absurd on 10ms blocks), SW termination kills WS state (keepalive + reconnection on every activation)
**Research flag:** Standard patterns well-documented in megaETH official docs. Skip research-phase.

### Phase 4: Token Ecosystem + History
**Rationale:** ERC-20 support and transaction history require stable RPC and WebSocket infra from phases 2-3. Block explorer APIs need time to stabilize on megaETH mainnet.
**Delivers:** ERC-20 token balances + transfers, transaction history (paginated via Blockscout/Etherscan API), token auto-discovery, bridge deposit detection, multidimensional gas display for power users
**Uses:** mega-tokenlist (cached in chrome.storage.local with TTL), Blockscout API
**Avoids:** Storage quota trap (last N txs locally, paginate from API), re-render jank on WebSocket messages (debounce 100-250ms)
**Research flag:** megaETH block explorer API stability and token list availability may need research — ecosystem is nascent.

### Phase 5: Advanced Features (v2)
**Rationale:** EIP-7702 requires security audit, audited delegation contracts, and a stable base. Transaction simulation needs fast state query infrastructure from Phase 3. Hardware wallet requires abstract signing interface which should be architected in Phase 2.
**Delivers:** Transaction simulation with balance-change preview, EIP-7702 batch transactions (approve + swap atomic), hardware wallet support (Ledger/Trezor)
**Avoids:** EIP-7702 replay attack (chainId always 4326, audited delegate contracts only), delegation front-running (atomic delegation + initialization)
**Research flag:** EIP-7702 needs deep research-phase — delegate contract design, security audit scope, megaETH hardfork timeline (Rex3) uncertain. Also: transaction simulation against megaETH pending mini-block state needs API research.

### Phase Ordering Rationale

- Phases 1-2 are pure backend — fully testable via TDD before any UI exists. This is intentional: crypto bugs and gas errors lose funds; discover them in tests, not prod.
- Phase 3 (realtime) is the megaETH differentiator but depends on Phase 2 (transactions) working correctly first — you can't accelerate broken transactions.
- Phase 4 (token ecosystem) deferred because megaETH's ERC-20 ecosystem is nascent at mainnet launch; building it too early means building against unstable APIs.
- Phase 5 (EIP-7702) explicitly post-MVP — security audit adds timeline, and the base fee being 0.001 gwei means gas abstraction has low urgency.
- Chrome Web Store submission happens at end of Phase 1 with minimal extension — validates acceptance before building for months.

### Research Flags

Phases needing deeper research during planning:
- **Phase 2:** EIP-6963 wallet compatibility matrix — which dapps check window.ethereum vs dispatch requestProvider, behavior with 3+ wallets installed
- **Phase 4:** megaETH block explorer API (Blockscout vs Etherscan) — rate limits, token list availability, API stability at mainnet
- **Phase 5:** EIP-7702 — delegate contract design, megaETH Rex3 hardfork timeline, transaction simulation against mini-block state

Phases with standard patterns (skip research-phase):
- **Phase 1:** Chrome MV3 lifecycle, @noble/@scure crypto, AES-256-GCM vault — comprehensive official docs
- **Phase 3:** megaETH Realtime API — official docs are detailed and specific

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All versions verified against npm + official docs. One MEDIUM: webext-zustand vs pegasus — evaluate at implementation |
| Features | HIGH | Verified against megaETH official docs + MetaMask/Rabby/Rainbow/Frame feature analysis |
| Architecture | HIGH | Chrome MV3 patterns well-established; megaETH-specific concerns from official docs |
| Pitfalls | HIGH | Critical pitfalls from official sources + real incidents (Trust Wallet breach, npm attack) |

**Overall confidence:** HIGH

### Gaps to Address

- **EIP-7702 on megaETH timeline:** LOW confidence on whether Rex3 hardfork enabling EIP-7702 is live at mainnet launch. Architect for it, don't block MVP on it. Validate during Phase 5 planning.
- **webext-zustand vs @webext-pegasus/store-zustand:** Both are viable for cross-context state sync. Evaluate at Phase 2 start — test with chrome.storage.session specifically.
- **megaETH block explorer API rate limits:** Not documented clearly. Will need empirical testing during Phase 4 planning.
- **megaETH token list availability:** mega-tokenlist JSON endpoint referenced but not fully documented. Validate during Phase 4.

## Sources

### Primary (HIGH confidence)
- [megaETH Realtime API docs](https://docs.megaeth.com/realtime-api) — stateChanges, realtime_sendRawTransaction, miniBlocks, keepalive
- [megaETH MegaEVM docs](https://docs.megaeth.com/megaevm) — multidimensional gas, 60k minimum
- [megaETH Mainnet docs](https://docs.megaeth.com/frontier) — chain IDs (4326/6343), RPC endpoints, bridge contract
- [Chrome MV3 Service Worker Lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) — SW termination, keepalive, alarms
- [chrome.storage API](https://developer.chrome.com/docs/extensions/reference/api/storage) — local vs session, quotas
- [WebSockets in Extension Service Workers](https://developer.chrome.com/docs/extensions/how-to/web-platform/websockets) — WS + SW lifecycle interaction
- [viem docs](https://viem.sh/docs/) — defineChain, EIP-7702, publicClient
- [Zustand docs](https://zustand.docs.pmnd.rs/) — persist middleware, chrome.storage adapter
- [EIP-1193](https://eips.ethereum.org/EIPS/eip-1193) + [EIP-6963](https://eips.ethereum.org/EIPS/eip-6963) — provider standards
- [Noble cryptography](https://paulmillr.com/noble/) — @noble/@scure audit lineage
- [Trust Wallet $8.5M Supply Chain Attack (Dec 2025)](https://thehackernews.com/2025/12/trust-wallet-chrome-extension-hack.html) — supply chain threat model
- [EIP-7702 Attack Surfaces — Nethermind](https://www.nethermind.io/blog/eip-7702-attack-surfaces-what-developers-should-know) — delegation security

### Secondary (MEDIUM confidence)
- [MiniRex Gas Guide (HackMD)](https://hackmd.io/@r3LiMJ7TSGmd1Jsi9FMX1A/B1gQzlOWbx) — practical megaETH gas implications
- [EIP-7702 wallet impact — Alchemy](https://www.alchemy.com/blog/eip-7702-metamask-and-wallets) — wallet implementation patterns
- [WXT vs esbuild comparison](https://redreamality.com/blog/the-2025-state-of-browser-extension-frameworks-a-comparative-analysis-of-plasmo-wxt-and-crxjs/) — build tooling decision
- [webext-zustand](https://github.com/sinanbekar/webext-zustand) — cross-context state sync (evaluate vs pegasus)
- [npm Supply Chain Attack Sept 2025](https://www.sisainfosec.com/blogs/npm-supply-chain-attack-hits-packages-with-billions-of-weekly-downloads-advisory-by-sisa-sappers/) — supply chain threat evidence
- [EIP-7702 Security — Halborn](https://www.halborn.com/blog/post/eip-7702-security-considerations) — delegation pitfalls

---
*Research completed: 2026-03-01*
*Ready for roadmap: yes*
