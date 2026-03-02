# Roadmap: Vibe Wallet

## Overview

Vibe Wallet ships in 9 phases following the dependency graph: build scaffold, then crypto foundation (TDD), then wallet UI shell, then ETH transactions with megaETH-native gas, then dapp connectivity (EIP-1193/6963), then real-time streaming (the killer differentiator), then transaction intelligence (simulation, finality, warnings), then ERC-20 token ecosystem, and finally transaction history with bridge onboarding. Each phase delivers a coherent, testable capability. Phases 1-4 produce a standalone wallet. Phases 5-9 add the features that make it categorically better than MetaMask on megaETH.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Build & Extension Scaffold** - MV3 manifest, esbuild multi-bundle pipeline, strict CSP, deterministic builds
- [x] **Phase 2: Cryptographic Foundation** - BIP-39/44 key derivation, AES-256-GCM vault, key isolation, crypto TDD
- [x] **Phase 3: Wallet Core UI & Lifecycle** - Create/import flow, lock/unlock, accounts, settings, service worker persistence
- [x] **Phase 4: ETH Transactions** - Send/receive ETH with megaETH gas (60k min), Type 2 tx, realtime send, confirmation UI
- [ ] **Phase 5: Dapp Provider & Connectivity** - EIP-1193/6963 injection, content script relay, signing methods, permissions
- [ ] **Phase 6: Real-Time Streaming** - WebSocket stateChanges, live balances, keepalive, reconnection, network health
- [ ] **Phase 7: Transaction Intelligence** - Multidimensional gas, finality indicators, simulation preview, approval warnings
- [ ] **Phase 8: Token Ecosystem** - ERC-20 balances and transfers, mega-tokenlist, manual import
- [ ] **Phase 9: History & Onboarding** - Transaction history via explorer API, bridge deposit detection, first-run flow

## Phase Details

### Phase 1: Build & Extension Scaffold
**Goal**: Extension loads in Chrome with correct MV3 manifest, strict CSP, and reproducible multi-bundle build
**Depends on**: Nothing (first phase)
**Requirements**: BUILD-01, BUILD-02, BUILD-03, BUILD-04, BUILD-05, BUILD-06
**Success Criteria** (what must be TRUE):
  1. Extension installs in Chrome from local build and shows popup with placeholder UI
  2. esbuild produces separate bundles for background (ESM), content script (IIFE), popup, and inpage (IIFE)
  3. CSP blocks inline scripts, eval, Function, and remote code loading -- verified by Chrome DevTools errors on violations
  4. Two consecutive builds from same source produce identical output (byte-for-byte)
  5. package.json has zero `^` or `~` version specifiers; lockfile integrity check passes
**Plans**: 2 plans

Plans:
- [x] 01-01-PLAN.md -- Project scaffold, configs, esbuild multi-bundle pipeline, entrypoints
- [x] 01-02-PLAN.md -- Styled placeholder popup UI, deterministic build + pin verification tests

### Phase 2: Cryptographic Foundation
**Goal**: User's keys are generated, derived, encrypted, and isolated correctly -- proven by test vectors
**Depends on**: Phase 1
**Requirements**: SEC-01, SEC-02, SEC-03, SEC-04, SEC-05, SEC-06, SEC-07, SEC-10, ACCT-01, TEST-01, TEST-02
**Success Criteria** (what must be TRUE):
  1. BIP-39 mnemonic generation passes published test vectors (12 and 24 words)
  2. BIP-44 derivation at m/44'/60'/0'/0/0 produces correct address for known seed phrases
  3. Vault encrypts with PBKDF2 (600k+ iterations) + AES-256-GCM; decrypt-after-encrypt round-trip matches original for edge-case passwords (empty, unicode, 1000+ chars)
  4. Encrypted vault persists in chrome.storage.local; decrypted key only in chrome.storage.session while unlocked
  5. Grep of entire codebase finds zero paths where private key bytes leave background service worker context
**Plans**: 3 plans

Plans:
- [x] 02-01-PLAN.md -- Crypto deps, BIP-39/BIP-44 modules, address derivation, test vectors
- [x] 02-02-PLAN.md -- PBKDF2 + AES-256-GCM vault encryption, progressive lockout, round-trip tests
- [x] 02-03-PLAN.md -- Background message handlers, chrome.storage integration, key isolation audit

### Phase 3: Wallet Core UI & Lifecycle
**Goal**: User can create or import a wallet, see their address, manage accounts, and lock/unlock with auto-timeout
**Depends on**: Phase 2
**Requirements**: SEC-08, SEC-09, ACCT-02, ACCT-03, SET-01, SET-02, SET-03, SET-04, SET-05
**Success Criteria** (what must be TRUE):
  1. User creates new wallet: sees seed phrase once, confirms word order, sets password, lands on main screen with address displayed
  2. User imports existing wallet via seed phrase and arrives at same main screen with correct derived address
  3. User locks wallet (manual or auto-timeout at 5/15/30/60 min); chrome.storage.session is cleared; unlock requires password
  4. User can derive additional accounts and switch between them; each shows correct address with copy-to-clipboard and QR code
  5. Service worker termination and restart preserves locked/unlocked state correctly (unlocked if session key exists, locked if not)
**Plans**: 3 plans

Plans:
- [x] 03-01-PLAN.md -- Zustand store, navigation, onboarding screens (welcome/create/import), lock screen, popup init
- [x] 03-02-PLAN.md -- Main screen (Phantom-style), sidebar account switcher, receive/QR, jazzicon, header rework
- [x] 03-03-PLAN.md -- Settings, auto-lock (chrome.alarms), seed export, network switcher, about page

### Phase 4: ETH Transactions
**Goal**: User can send and receive ETH on megaETH with correct gas estimation, instant confirmation, and full transaction lifecycle
**Depends on**: Phase 3
**Requirements**: TX-01, TX-02, TX-03, TX-04, TX-05, TX-06, TX-07, TX-08, TX-09, TX-15, TX-16, TEST-03, TEST-04, TEST-06
**Success Criteria** (what must be TRUE):
  1. User enters recipient and amount, sees confirmation screen with recipient, amount, gas cost, and total cost
  2. "Max" button correctly calculates maximum sendable ETH after gas deduction
  3. Gas estimation always calls megaETH RPC eth_estimateGas, enforces 60k minimum floor, applies 20% buffer -- no tx ever submitted with gas < 60,000
  4. Transaction submits via realtime_sendRawTransaction and result (success/failure + explorer link) appears within seconds; falls back to standard send + poll on 10s timeout
  5. Transaction serialization (EIP-1559 Type 2 + RLP) passes published test vectors; sequential transactions use sequential nonces
**Plans**: 3 plans

Plans:
- [x] 04-01-PLAN.md -- Install micro-eth-signer, RPC provider, gas estimation, tx construction/signing, price module, manifest CSP, background handlers
- [x] 04-02-PLAN.md -- TDD: tx serialization test vectors, gas floor enforcement, sequential nonce correctness
- [x] 04-03-PLAN.md -- Send flow UI (4 screens: recipient, amount, confirm, result), BalanceDisplay, store updates, App.tsx wiring

### Phase 5: Dapp Provider & Connectivity
**Goal**: Dapps can discover the wallet, connect with user approval, and send transactions or request signatures through standard Ethereum provider API
**Depends on**: Phase 4
**Requirements**: DAPP-01, DAPP-02, DAPP-03, DAPP-04, DAPP-05, DAPP-06, DAPP-07, DAPP-08, DAPP-09, DAPP-10, DAPP-11, TEST-05
**Success Criteria** (what must be TRUE):
  1. Dapp discovers wallet via EIP-6963 event and connects via eth_requestAccounts with user approval dialog
  2. Dapp can send transactions (eth_sendTransaction) through full confirmation flow with simulation preview
  3. Dapp can request personal_sign (plaintext display) and eth_signTypedData_v4 (structured display, Permit warning); eth_sign blocked by default
  4. Provider responds correctly to eth_chainId, eth_accounts, net_version; wallet_switchEthereumChain accepts megaETH chains only
  5. No internal wallet state is accessible from the provider object; content script messages never contain key material
**Plans**: TBD

Plans:
- [x] 05-01-PLAN.md -- EIP-1193 provider injection, EIP-6963 discovery, content script relay, background dapp routing, RPC whitelist, connected sites storage
- [ ] 05-02-PLAN.md -- Pending request queue, approval popup flow, signing handlers (personal_sign + signTypedData_v4), dapp tx execution, simulation
- [ ] 05-03-PLAN.md -- Dapp UI screens (connect, sign, confirm, connections), connection indicator, Permit warnings, provider isolation test (TEST-05)

### Phase 6: Real-Time Streaming
**Goal**: Balances update in real time and network health is visible -- the user sees megaETH's speed, not poll-and-refresh
**Depends on**: Phase 4
**Requirements**: RT-01, RT-02, RT-03, RT-04, RT-05, RT-06, RT-07
**Success Criteria** (what must be TRUE):
  1. ETH balance updates in popup within ~100ms of on-chain state change via stateChanges WebSocket subscription
  2. Green "live" indicator in popup header signals active real-time streaming; goes yellow/red on degradation
  3. WebSocket stays alive via eth_chainId keepalive every 25s; reconnects automatically after SW termination with full state refresh
  4. Network health indicator (green/yellow/red) reflects miniBlock production rate and RPC responsiveness
  5. Network issues surface as clear user-facing messages, never silent failures
**Plans**: TBD

Plans:
- [ ] 06-01: TBD
- [ ] 06-02: TBD

### Phase 7: Transaction Intelligence
**Goal**: User sees detailed gas breakdown, finality progression, balance-change previews, and safety warnings before signing
**Depends on**: Phase 4, Phase 6
**Requirements**: TX-10, TX-11, TX-12, TX-13, TX-14
**Success Criteria** (what must be TRUE):
  1. Confirmation screen shows compute gas + storage gas breakdown (multidimensional gas)
  2. After submission, finality indicator progresses: preconfirmed (~10ms) to confirmed (~1s) to L1 settled
  3. Transaction simulation (eth_call) shows balance-change preview before user signs
  4. Unlimited ERC-20 approvals display prominent warning; unknown contract interactions show verification status
**Plans**: TBD

Plans:
- [ ] 07-01: TBD
- [ ] 07-02: TBD

### Phase 8: Token Ecosystem
**Goal**: User can view and transfer ERC-20 tokens with the same UX quality as ETH
**Depends on**: Phase 4, Phase 6
**Requirements**: TOK-01, TOK-02, TOK-03, TOK-04, TOK-05
**Success Criteria** (what must be TRUE):
  1. Popular tokens auto-detected via mega-tokenlist; balances display alongside ETH on main screen
  2. User can send ERC-20 tokens with same gas estimation and confirmation flow as ETH transfers
  3. User can manually import any ERC-20 token by contract address
  4. megaETH ecosystem tokens (MEGA, USDm) are visually highlighted
**Plans**: TBD

Plans:
- [ ] 08-01: TBD
- [ ] 08-02: TBD

### Phase 9: History & Onboarding
**Goal**: User can review past transactions and new users get guided from empty wallet to funded wallet
**Depends on**: Phase 4, Phase 8
**Requirements**: HIST-01, HIST-02, HIST-03, RT-08, RT-09
**Success Criteria** (what must be TRUE):
  1. Recent transactions (sent + received) display with status, amount, and timestamp
  2. Each transaction links to megaETH block explorer page
  3. Bridge deposit (ETH arriving via L1 bridge contract) triggers notification in wallet
  4. First-run with empty balance shows bridge instructions to help user fund their wallet
**Plans**: TBD

Plans:
- [ ] 09-01: TBD
- [ ] 09-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9
Note: Phases 5, 6 both depend on Phase 4. Phases 7, 8 depend on 4+6. Phase 9 depends on 4+8.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Build & Extension Scaffold | 2/2 | Complete | 2026-03-01 |
| 2. Cryptographic Foundation | 3/3 | Complete | 2026-03-01 |
| 3. Wallet Core UI & Lifecycle | 3/3 | Complete | 2026-03-01 |
| 4. ETH Transactions | 3/3 | Complete | 2026-03-01 |
| 5. Dapp Provider & Connectivity | 1/3 | In Progress | - |
| 6. Real-Time Streaming | 0/TBD | Not started | - |
| 7. Transaction Intelligence | 0/TBD | Not started | - |
| 8. Token Ecosystem | 0/TBD | Not started | - |
| 9. History & Onboarding | 0/TBD | Not started | - |
