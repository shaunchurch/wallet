---
phase: 05-dapp-provider-connectivity
plan: 01
subsystem: dapp
tags: [eip-1193, eip-6963, rpc-whitelist, content-script, provider-injection, chrome-extension]

# Dependency graph
requires:
  - phase: 04-eth-transactions
    provides: rpcCall, NETWORKS, getNetworkPreference pattern
provides:
  - EIP-1193 provider (window.ethereum) with request/on/removeListener
  - EIP-6963 announceProvider discovery
  - Content script bidirectional relay (page <-> background)
  - DappRpcRequest/DappRpcResponse/DappEvent type system
  - RPC_WHITELIST with direct/approval/blocked classification
  - Connected sites CRUD (chrome.storage.local)
  - Background dapp:rpc handler routing direct/approval/blocked methods
affects: [05-02-approval-handlers, 05-03-connection-ui]

# Tech tracking
tech-stack:
  added: []
  patterns: [three-layer-relay, frozen-provider, origin-from-content-script, separate-listeners]

key-files:
  created:
    - src/features/dapp/types.ts
    - src/features/dapp/rpc-whitelist.ts
    - src/features/dapp/connections.ts
  modified:
    - src/entrypoints/inpage.ts
    - src/entrypoints/content.ts
    - src/entrypoints/background.ts

key-decisions:
  - "export {} for TS module isolation in IIFE entrypoints (inpage, content)"
  - "Separate chrome.runtime.onMessage listener for dapp:rpc (not mixed with wallet: handler)"
  - "Provider frozen via Object.freeze -- _emit/_handleResponse still callable but no state mutation"

patterns-established:
  - "vibewallet-provider channel + direction field for inpage<->content messaging"
  - "Content script attaches origin via window.location.origin, never trusts page payload"
  - "Background dapp handler parallel to wallet handler with separate sender checks"

requirements-completed: [DAPP-01, DAPP-02, DAPP-07, DAPP-08, DAPP-09, DAPP-10, DAPP-11]

# Metrics
duration: 4min
completed: 2026-03-02
---

# Phase 5 Plan 1: Dapp Provider Injection Summary

**EIP-1193 provider + EIP-6963 discovery injected via content script relay, with RPC whitelist routing direct/blocked/approval methods through background**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-02T09:30:04Z
- **Completed:** 2026-03-02T09:34:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Three-layer relay chain: inpage (MAIN world) -> content script (ISOLATED world) -> background (service worker)
- EIP-1193 compliant provider with request(), on(), removeListener() -- frozen, no mutable state exposed
- EIP-6963 announces on load and re-announces on eip6963:requestProvider events
- RPC whitelist classifies 23 methods: 19 direct, 4 approval, 1 blocked
- eth_chainId/eth_accounts/net_version/web3_clientVersion handled locally
- wallet_switchEthereumChain accepts only megaETH chains (4326, 6343)
- eth_sign blocked with 4200 unless ethSignEnabled flag set
- All other direct methods proxy to megaETH RPC node

## Task Commits

1. **Task 1: Dapp types, RPC whitelist, connected sites storage** - `6794c97` (feat)
2. **Task 2: Inpage provider + content relay + background handler** - `d1092e8` (feat)

## Files Created/Modified
- `src/features/dapp/types.ts` - DappRpcRequest, DappRpcResponse, DappEvent, ConnectedSite, RPC_ERRORS
- `src/features/dapp/rpc-whitelist.ts` - RPC_WHITELIST record + getMethodCategory helper
- `src/features/dapp/connections.ts` - Connected sites CRUD (get/add/remove/removeAll)
- `src/entrypoints/inpage.ts` - VibeWalletProvider class + EIP-6963 announcement
- `src/entrypoints/content.ts` - Bidirectional message relay + getFavicon helper
- `src/entrypoints/background.ts` - handleDappRpc + handleDirectRpc + dapp listener

## Decisions Made
- Used `export {}` in inpage.ts and content.ts to enforce TS module isolation (both build as IIFE but TS needs module boundaries to avoid `CHANNEL` variable conflicts)
- Separate `chrome.runtime.onMessage.addListener` for dapp:rpc -- keeps wallet and dapp message paths independent
- Provider frozen via `Object.freeze(new VibeWalletProvider())` -- internal methods `_emit` and `_handleResponse` remain callable through the message listener closure, but no external state mutation possible

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added export {} for TS module isolation in IIFE entrypoints**
- **Found during:** Task 2 (typecheck)
- **Issue:** TS2451: Cannot redeclare block-scoped variable 'CHANNEL' -- inpage.ts and content.ts both declare `const CHANNEL` and TS treats scripts (non-modules) as sharing global scope
- **Fix:** Added `export {};` at top of both files to make TS treat them as isolated modules
- **Files modified:** src/entrypoints/inpage.ts, src/entrypoints/content.ts
- **Verification:** pnpm typecheck passes
- **Committed in:** d1092e8 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary for TS compilation. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviation above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Provider injection and relay chain complete -- approval handlers (eth_requestAccounts, eth_sendTransaction, personal_sign) ready to implement in plan 05-02
- Connected sites storage module ready for connection management UI in plan 05-03
- Direct RPC methods (eth_getBalance, eth_call, etc.) fully functional through relay

## Self-Check: PASSED

All 6 files verified present. Both task commits (6794c97, d1092e8) verified in git log.

---
*Phase: 05-dapp-provider-connectivity*
*Completed: 2026-03-02*
