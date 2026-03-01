---
phase: 04-eth-transactions
plan: 01
subsystem: transactions
tags: [micro-eth-signer, eip-1559, rpc, gas-estimation, coingecko, megaeth]

requires:
  - phase: 02-wallet-core
    provides: "HD derivation, vault encryption, session management"
  - phase: 03-wallet-ui
    provides: "Message-passing pattern, network preference in store"
provides:
  - "JSON-RPC provider for megaETH mainnet/testnet"
  - "Gas estimation with 20% buffer + 60k floor"
  - "EIP-1559 Type 2 tx construction/signing via micro-eth-signer"
  - "ETH/USD price fetch with 60s cache"
  - "Background handlers: getBalance, estimateGas, getFeeParams, getEthPrice, sendTransaction"
  - "WalletMessage/WalletResponse types for full tx flow"
affects: [04-02, 04-03, 05-dapp-connector]

tech-stack:
  added: [micro-eth-signer@0.18.1]
  patterns: [hex-string BigInt serialization, realtime-first tx submission, module-level price cache]

key-files:
  created:
    - src/features/wallet/rpc/provider.ts
    - src/features/wallet/rpc/gas.ts
    - src/features/wallet/rpc/index.ts
    - src/features/wallet/tx/build.ts
    - src/features/wallet/tx/index.ts
    - src/features/wallet/price/coingecko.ts
    - src/features/wallet/price/index.ts
  modified:
    - src/features/wallet/types.ts
    - src/entrypoints/background.ts
    - public/manifest.json
    - package.json

key-decisions:
  - "All BigInt values serialized as 0x hex strings across message boundary (JSON can't serialize BigInt)"
  - "realtime_sendRawTransaction tried first with 10s timeout, fallback to eth_sendRawTransaction + poll"
  - "Recent addresses deduped by lowercase comparison, capped at 10, stored in chrome.storage.local"
  - "Transaction.prepare() + signBy() pattern from micro-eth-signer for EIP-1559 Type 2"
  - "eth_gasPrice used as baseFee proxy (megaETH returns effective gas price)"

patterns-established:
  - "Hex string serialization: all BigInt values as 0x-prefixed hex strings in WalletMessage/WalletResponse"
  - "Parallel RPC: nonce + feeParams + gasEstimate fetched concurrently before signing"
  - "Module-level cache pattern: price cache with TTL at module scope"

requirements-completed: [TX-03, TX-04, TX-05, TX-07, TX-08, TX-09, TX-15, TX-16]

duration: 21min
completed: 2026-03-01
---

# Phase 4 Plan 01: Transaction Backend Summary

**RPC provider, gas estimation (20% buffer + 60k floor), EIP-1559 Type 2 tx construction via micro-eth-signer, CoinGecko price cache, and 5 background handlers for full send flow**

## Performance

- **Duration:** 21 min
- **Started:** 2026-03-01T21:34:21Z
- **Completed:** 2026-03-01T21:56:00Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- RPC provider calling megaETH mainnet/testnet endpoints with JSON-RPC 2.0 wrapper
- Gas estimation with 20% buffer applied before 60k floor enforcement
- EIP-1559 Type 2 transaction construction + signing (private key never leaves background.ts)
- ETH/USD price from CoinGecko with 60s module-level cache
- 5 new message handlers: getBalance, estimateGas, getFeeParams, getEthPrice, sendTransaction
- Realtime tx submission with 10s timeout fallback to standard send + poll
- Recent address tracking (max 10, deduplicated, most-recent-first)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install micro-eth-signer + create modules** - `af55860` (feat)
2. **Task 2: Extend message types + add background handlers** - `f6dad46` (feat)

## Files Created/Modified
- `src/features/wallet/rpc/provider.ts` - JSON-RPC 2.0 fetch wrapper, network config (mainnet/testnet URLs, chain IDs)
- `src/features/wallet/rpc/gas.ts` - Gas estimation with 20% buffer + 60k floor, fee params fetcher
- `src/features/wallet/rpc/index.ts` - Barrel export
- `src/features/wallet/tx/build.ts` - EIP-1559 Type 2 tx build/sign, formatEth, parseEthToWei, validateAddress
- `src/features/wallet/tx/index.ts` - Barrel export
- `src/features/wallet/price/coingecko.ts` - ETH/USD price with 60s cache
- `src/features/wallet/price/index.ts` - Barrel export
- `src/features/wallet/types.ts` - Added RecentAddress, 5 WalletMessage + 5 WalletResponse variants
- `src/entrypoints/background.ts` - 5 new handlers, getNetworkPreference, saveRecentAddress helpers
- `public/manifest.json` - host_permissions for megaETH RPC + CoinGecko
- `package.json` - micro-eth-signer@0.18.1 exact pin

## Decisions Made
- All BigInt values serialized as 0x hex strings across message boundary (JSON can't serialize BigInt)
- realtime_sendRawTransaction tried first with 10s timeout, fallback to eth_sendRawTransaction + poll receipt every 500ms
- Recent addresses deduped by lowercase comparison, capped at 10, stored in chrome.storage.local
- Transaction.prepare() + signBy() pattern from micro-eth-signer for EIP-1559 Type 2
- eth_gasPrice used as baseFee proxy (megaETH returns effective gas price from this RPC method)

## Deviations from Plan

None - plan executed exactly as written. Task 1 modules and manifest were committed in a prior session (af55860); Task 2 types and handlers completed in this session.

## Issues Encountered

Pre-existing lint formatting errors in UI files (Sidebar.tsx, AboutScreen.tsx, SettingsScreen.tsx, store.ts) from prior phases. Not caused by this plan's changes -- out of scope per deviation rules.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All backend infrastructure for ETH transactions is complete
- Popup can now send typed messages for balance, gas, price, and transactions
- Ready for 04-02 (Send UI screens) and 04-03 (Activity/history)

---
*Phase: 04-eth-transactions*
*Completed: 2026-03-01*
