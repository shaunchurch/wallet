# MegaWallet

## What This Is

A Chrome browser extension wallet built from scratch for megaETH, the real-time Ethereum L2. Purpose-built to exploit megaETH's unique characteristics — 10ms block times, Realtime API, multidimensional gas, EIP-7702 — delivering a UX that feels like a native fintech app rather than a crypto wallet.

## Core Value

Transactions confirm instantly and balances update in real time. The fastest chain gets the fastest wallet.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Secure key management (BIP-39/BIP-44, AES-256-GCM encryption, key isolation)
- [ ] Send/receive ETH with megaETH-correct gas estimation (60k minimum, RPC-only)
- [ ] EIP-1193 dapp connection (provider injection, eth_sendTransaction, signing)
- [ ] Real-time balance updates via WebSocket stateChanges subscription
- [ ] Instant tx confirmation via realtime_sendRawTransaction
- [ ] Finality indicators (preconfirmed → confirmed → L1 settled)
- [ ] ERC-20 token support with mega-tokenlist integration
- [ ] EIP-7702 transaction batching (approve+swap atomic)
- [ ] Transaction simulation and approval warnings
- [ ] Transaction history via block explorer API
- [ ] Network health monitoring
- [ ] Bridge deposit detection

### Out of Scope

- Multi-chain support — megaETH-only is the differentiator
- Mobile app — Chrome extension first
- Hardware wallet (Ledger/Trezor) — post-launch, but architect signing interface to accommodate
- Swap aggregation — not in initial scope
- ENS resolution — stretch goal, not committed
- Gas abstraction (pay gas in tokens) — post-MVP EIP-7702 feature
- Session keys / spending limits — post-MVP EIP-7702 feature

## Context

- megaETH is actively evolving (MiniRex, Rex, Rex1, Rex2 hardforks) — gas model may change
- MetaMask/Rabby fail on megaETH due to multidimensional gas (21k vs 60k minimum)
- Manifest V3 service workers get terminated by Chrome — need reconnection strategy
- Supply chain security is critical — wallet extension is highest-value npm attack target
- Empty String (emptystring.dev) is the builder
- Open source at launch, private during development

## Constraints

- **Stack**: React + TypeScript + shadcn/ui, Zustand, esbuild, viem (minimal subset), @noble/@scure crypto
- **Security**: Zero-dependency crypto libs only. No eval/Function/dynamic imports. Strict CSP.
- **Testing**: Full TDD for all cryptographic operations and transaction serialization
- **Dependencies**: Exact version pins, no ^ or ~. Every new package requires justification.
- **Build**: Deterministic/reproducible. Separate bundles for background, content script, popup.
- **Network**: Both testnet (chain 6343) and mainnet (chain 4326) from start

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| megaETH-only, no multi-chain | Deeper integration, clearer brand, simpler codebase | — Pending |
| React + shadcn/ui for popup | Accessible components, fast dev for confirmation dialogs | — Pending |
| @noble/@scure for crypto | Audited, zero-dep, single trusted author (Paul Miller) | — Pending |
| esbuild over webpack/vite | Fast, simple, separate bundles per context | — Pending |
| Full TDD on crypto layer | Key management and signing correctness is non-negotiable | — Pending |
| Public at launch, private dev | Verify code quality before open-sourcing | — Pending |
| Build all 3 phases, ship 1-2 first | Differentiators are crucial but MVP comes first | — Pending |

---
*Last updated: 2026-03-01 after initialization*
