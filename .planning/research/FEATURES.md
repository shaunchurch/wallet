# Feature Research

**Domain:** Browser extension crypto wallet (megaETH L2)
**Researched:** 2026-03-01
**Confidence:** HIGH (features verified against MetaMask, Rabby, Rainbow, Frame docs + megaETH official docs)

## Feature Landscape

### Table Stakes (Users Expect These)

Missing any of these = users immediately switch back to MetaMask/Rabby.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Seed phrase create/import (BIP-39/44) | Every wallet has this. No seed = no wallet | MEDIUM | AES-256-GCM encryption, PBKDF2 600k+ iterations. Use @scure/bip39, @noble/secp256k1. Memory zeroing after use |
| Send/receive ETH | Core function of any wallet | MEDIUM | megaETH-specific: 60k min gas (not 21k). Must use native `eth_estimateGas` — never hardcode |
| EIP-1193 + EIP-6963 provider injection | Dapps won't detect wallet without it | HIGH | EIP-6963 multi-wallet discovery is now standard (MetaMask, Rabby, Rainbow all support). Content script + inpage script architecture |
| Transaction confirmation UI | Users must review before signing | MEDIUM | Show to/from, value, gas, decoded calldata. Rabby set the bar with balance-change preview |
| ERC-20 token balances + transfers | Users hold tokens, not just ETH | MEDIUM | Token list integration (mega.etherscan.io/tokens). Auto-discovery via transfer events or curated list |
| Transaction history | Users expect to see past activity | MEDIUM | megaETH Etherscan API (mega.etherscan.io) or Blockscout API. Paginated, filterable |
| Network configuration | Users need correct chain params | LOW | Chain 4326 (mainnet), 6343 (testnet). RPC: mainnet.megaeth.com/rpc. Auto-configured since megaETH-only |
| Account management (multiple accounts) | HD wallets derive multiple accounts. Standard UX | LOW | BIP-44 derivation path m/44'/60'/0'/0/n |
| Password lock/unlock | Protects against casual physical access | LOW | Encrypt vault at rest. Auto-lock on idle timeout |
| Popup + notification UX | Chrome extension standard interaction model | MEDIUM | Manifest V3 popup, notification for pending tx approval. Must handle service worker termination |

### Differentiators (Competitive Advantage)

These exploit megaETH's unique capabilities. No other wallet does these because no other wallet targets megaETH specifically.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Real-time balance via stateChanges WebSocket** | Balance updates in ~10ms, not on refresh/poll. Feels like a bank app, not a blockchain wallet | HIGH | `eth_subscribe("stateChanges", [addresses])`. Must handle: WS reconnection (30s keepalive via eth_chainId ping), service worker termination (Manifest V3), state sync between background/popup. This is THE killer feature |
| **Instant tx confirmation via realtime_sendRawTransaction** | Submit + confirm in one RPC call (~10ms). No polling, no spinners, no "pending" state | MEDIUM | Returns receipt directly. 10s timeout → error. Eliminates eth_sendRawTransaction + polling loop entirely. UX: tx button → confirmed, near-instant |
| **Finality indicator (preconfirmed → confirmed → L1 settled)** | Shows users the actual security level of their tx. Transparent, educational, trust-building | MEDIUM | 3 stages: mini-block inclusion (~10ms), EVM block inclusion (~1s), L1 finality (minutes). No other wallet shows this granularity. Can use miniBlocks subscription to track |
| **Multidimensional gas display** | Show compute gas + storage gas breakdown. Helps power users understand costs. Prevents "intrinsic gas too low" errors that plague MetaMask on megaETH | MEDIUM | 60k intrinsic = 21k compute + 39k storage. Display both dimensions. Use native eth_estimateGas only. Storage-heavy txs (contract deploy, SSTORE) show why gas is higher |
| **EIP-7702 transaction batching** | Approve + swap in one click. No more "approve then wait then swap" dance | HIGH | Type 4 tx. EOA delegates to smart contract code. Atomic multi-call: [approve, swap] as single tx. Needs: delegation contract deployment, authorization signing, batch encoding. Significant security surface |
| **Transaction simulation with balance-change preview** | Show "you will send X, receive Y" before signing. Rabby made this expected; we do it with megaETH-speed simulation | HIGH | Use eth_call against pending mini-block state for near-instant simulation. Decode token transfers from logs. Show warnings for approvals, unknown contracts. Can leverage megaETH's fast state queries |
| **Bridge deposit detection** | Auto-detect when ETH arrives via L1 bridge. Notify user without them checking | LOW | Monitor L1 bridge contract (0x0CA3A2FB...a2eE75) events or watch for balance changes via stateChanges subscription. Deposit = native transfer to bridge address on L1 |
| **Mini-block streaming (dev/power user)** | Live feed of chain activity. Network health at a glance | LOW | `eth_subscribe("miniBlocks")`. Show: blocks/sec, gas used, tx count. Optional/advanced feature. Signals "this chain is alive" |
| **megaETH-native network health** | Show chain liveness, sequencer status, current throughput | LOW | Derived from miniBlocks stream. Base fee (0.001 gwei) is essentially zero — worth displaying to show cost advantage |

### Anti-Features (Deliberately NOT Building)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Multi-chain support | "I use 5 chains" | Destroys the value prop. megaETH-only focus IS the differentiator. Multi-chain = mediocre everywhere. MetaMask/Rabby already own this | Single-chain excellence. Users keep MetaMask for other chains |
| Built-in swap aggregator | "Let me trade in-wallet" | Massive scope: DEX routing, slippage, MEV protection, liquidity sources. Entire product unto itself | Deep-link to megaETH DEXs. EIP-7702 batching makes external DEX UX better anyway |
| NFT gallery/management | "Show me my NFTs" | Low value relative to complexity. NFT ecosystem on megaETH is nascent. Display bloat | Link to block explorer for NFT viewing. Maybe add NFT detection later |
| ENS resolution | ".eth names in address bar" | megaETH doesn't have native ENS. Cross-chain ENS resolution adds L1 dependency and latency | Plain addresses. Consider megaETH-native naming if one emerges |
| Fiat on-ramp | "Buy crypto in wallet" | Regulatory complexity, KYC integration, third-party dependency. Not a wallet problem | Link to exchanges/on-ramps that support megaETH |
| Built-in portfolio analytics | "Show me my P&L" | Scope creep. Zerion/DeBank do this better. Token price feeds add dependencies | Show balances + values. Link to portfolio trackers |
| Hardware wallet support (v1) | "I use a Ledger" | Adds WebUSB/HID complexity, device communication, signing flow changes. Architect for it but don't build yet | Design signing interface as abstract. Add Ledger/Trezor post-launch |
| Gas abstraction (pay gas in tokens) | "I don't have ETH for gas" | Requires paymaster infrastructure, token price oracle, relay network. EIP-7702 feature but significant backend | Defer to post-MVP. Base fee is 0.001 gwei so gas is nearly free anyway |
| Session keys / spending limits | "Auto-approve small txs" | Security risk if implemented poorly. Smart contract delegation surface. User education burden | Defer to post-MVP EIP-7702 phase. Get basic batching right first |

## Feature Dependencies

```
[Seed phrase / key management]
    +-- [Send/receive ETH]
    |       +-- [ERC-20 transfers]
    |       +-- [Transaction history]
    |       +-- [realtime_sendRawTransaction]
    |               +-- [Finality indicator]
    +-- [EIP-1193 provider injection]
    |       +-- [Dapp tx signing]
    |               +-- [Transaction simulation]
    |               +-- [EIP-7702 batching]
    +-- [Password lock/unlock]

[WebSocket connection management]
    +-- [stateChanges subscription (real-time balances)]
    +-- [miniBlocks subscription (network health)]
    +-- [Bridge deposit detection]

[Multidimensional gas estimation]
    +-- [Send/receive ETH] (required: correct gas)
    +-- [ERC-20 transfers] (required: correct gas)
    +-- [EIP-7702 batching] (required: correct gas)
```

### Dependency Notes

- **Key management is root dependency:** Nothing works without it. Build first, test exhaustively
- **WebSocket infra is second root:** stateChanges, miniBlocks, and bridge detection all share WS connection management. Manifest V3 service worker lifecycle makes this tricky — need reconnection strategy
- **Multidimensional gas cuts across all tx features:** Every transaction must use megaETH-native gas estimation. Hardcoding 21k (like MetaMask does) breaks everything
- **EIP-7702 depends on basic signing + gas estimation:** Can't batch transactions if single transactions don't work correctly
- **Transaction simulation enhances but doesn't block dapp signing:** Ship basic signing first, add simulation overlay

## MVP Definition

### Launch With (v1)

Minimum to be useful as a daily-driver megaETH wallet.

- [ ] Seed phrase create/import with AES-256-GCM encryption — core security, non-negotiable
- [ ] Send/receive ETH with megaETH gas estimation (60k min) — basic utility
- [ ] EIP-1193 + EIP-6963 provider injection — dapp connectivity
- [ ] Real-time balance via stateChanges WebSocket — THE differentiator, ship from day 1
- [ ] Instant tx via realtime_sendRawTransaction — feels broken without it
- [ ] Transaction confirmation UI with gas breakdown — user safety
- [ ] Password lock + auto-lock — basic security
- [ ] Finality indicator (preconfirmed/confirmed/settled) — low-cost high-impact differentiator
- [ ] Network config for mainnet (4326) + testnet (6343) — developer + user coverage

### Add After Validation (v1.x)

Once core is stable and users are onboarded.

- [ ] ERC-20 token support — when megaETH token ecosystem grows
- [ ] Transaction history — once block explorer APIs stabilize
- [ ] Transaction simulation / balance-change preview — when dapp usage grows
- [ ] Bridge deposit detection — quality of life
- [ ] Multidimensional gas display (compute + storage breakdown) — power user feature
- [ ] Network health dashboard — trust and transparency signal

### Future Consideration (v2+)

- [ ] EIP-7702 transaction batching — high value but high complexity. Needs delegation contracts, security audit
- [ ] Hardware wallet (Ledger/Trezor) — post-launch, signing interface already abstracted
- [ ] Gas abstraction (pay in tokens) — post-MVP, requires paymaster
- [ ] Session keys / spending limits — post-MVP, requires extensive security review

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Seed phrase management | HIGH | MEDIUM | P1 |
| Send/receive ETH (megaETH gas) | HIGH | MEDIUM | P1 |
| EIP-1193/6963 provider | HIGH | HIGH | P1 |
| stateChanges real-time balance | HIGH | HIGH | P1 |
| realtime_sendRawTransaction | HIGH | LOW | P1 |
| Tx confirmation UI | HIGH | MEDIUM | P1 |
| Finality indicator | MEDIUM | LOW | P1 |
| Password lock | HIGH | LOW | P1 |
| ERC-20 tokens | MEDIUM | MEDIUM | P2 |
| Transaction history | MEDIUM | MEDIUM | P2 |
| Tx simulation/preview | HIGH | HIGH | P2 |
| Bridge deposit detection | LOW | LOW | P2 |
| Gas breakdown display | MEDIUM | LOW | P2 |
| Network health | LOW | LOW | P2 |
| EIP-7702 batching | HIGH | HIGH | P3 |
| Hardware wallet | MEDIUM | HIGH | P3 |

**Priority key:**
- P1: Must have for launch — wallet is broken without these
- P2: Should have, add in v1.x releases
- P3: Future phases, high value but high cost

## Competitor Feature Analysis

| Feature | MetaMask | Rabby | Rainbow | Frame | Vibe Wallet (Ours) |
|---------|----------|-------|---------|-------|-------------------|
| Multi-chain | 15+ chains | 100+ EVM | 6 L2s + ETH | Omnichain | megaETH only (by design) |
| Tx simulation | Basic (via Blockaid) | Full balance-change preview | None | Decoded calldata | Balance-change + megaETH-speed sim |
| Real-time balance | Poll on refresh | Poll on refresh | Poll on refresh | Poll on refresh | WebSocket stateChanges (~10ms) |
| Instant confirmation | Poll for receipt | Poll for receipt | Poll for receipt | Poll for receipt | realtime_sendRawTransaction |
| Gas estimation | Generic (fails on megaETH 21k→60k) | Generic | Smart estimation | Standard | megaETH-native multidimensional |
| Finality display | Confirmed/pending | Confirmed/pending | Confirmed/pending | Confirmed/pending | Preconfirmed → Confirmed → L1 |
| EIP-7702 | In development | Unknown | Unknown | Unknown | Planned v2 (batching) |
| Hardware wallet | Ledger, Trezor, Lattice | Ledger, Trezor, GridPlus, Keystone | Ledger, Trezor | GridPlus, Ledger, Trezor | Post-launch (interface ready) |
| Provider standard | EIP-1193 + 6963 | EIP-1193 + 6963 (MetaMask disguise) | EIP-1193 + 6963 | Native desktop injection | EIP-1193 + 6963 |
| Open source | Yes | Yes | Yes | Yes | Yes (at launch) |
| Onboarding | Seed phrase + optional Snap | Seed phrase | Seed phrase | Seed phrase + HW | Seed phrase |

### Key Competitive Insight

MetaMask and Rabby **fail on megaETH** because they hardcode 21k gas for ETH transfers. megaETH requires 60k (21k compute + 39k storage). This is the wedge: existing wallets are literally broken on megaETH. A purpose-built wallet that handles multidimensional gas correctly is immediately more useful than the market leader.

## Sources

- [MegaETH Realtime API docs](https://docs.megaeth.com/realtime-api) — HIGH confidence: stateChanges, realtime_sendRawTransaction, miniBlocks
- [MegaETH MegaEVM docs](https://docs.megaeth.com/megaevm) — HIGH confidence: multidimensional gas model, 60k intrinsic gas
- [MegaETH Mainnet docs](https://docs.megaeth.com/frontier) — HIGH confidence: chain IDs, RPC endpoints, bridge contract
- [MegaETH RPC docs](https://docs.megaeth.com/rpc) — HIGH confidence: available methods, rate limits
- [MiniRex Gas Guide (HackMD)](https://hackmd.io/@r3LiMJ7TSGmd1Jsi9FMX1A/B1gQzlOWbx) — MEDIUM confidence: practical gas implications
- [MetaMask extension](https://metamask.io/) — HIGH confidence: feature set baseline
- [Rabby wallet](https://rabby.io/) — HIGH confidence: tx simulation, balance preview UX
- [Rainbow extension](https://rainbow.me/) — HIGH confidence: keyboard shortcuts, speed focus
- [Frame wallet](https://frame.sh/) — HIGH confidence: desktop-native, omnichain routing
- [EIP-7702 wallet impact (Alchemy)](https://www.alchemy.com/blog/eip-7702-metamask-and-wallets) — MEDIUM confidence: wallet implementation approaches
- [MetaMask EIP-6963 guide](https://metamask.io/news/how-to-implement-eip-6963-support-in-your-web3-dapp) — HIGH confidence: provider injection standard
- [Nadcab secure wallet guide](https://www.nadcab.com/blog/secure-crypto-wallet-browser-extension-architecture-guide) — MEDIUM confidence: security architecture patterns

---
*Feature research for: Vibe Wallet — megaETH browser extension wallet*
*Researched: 2026-03-01*
