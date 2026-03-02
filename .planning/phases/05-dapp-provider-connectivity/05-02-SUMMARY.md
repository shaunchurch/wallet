---
phase: 05-dapp-provider-connectivity
plan: 02
subsystem: dapp
tags: [approval-flow, pending-request, signing, eip-191, eip-712, permit-detection, calldata-decode, chrome-windows]

# Dependency graph
requires:
  - phase: 05-dapp-provider-connectivity
    plan: 01
    provides: DappRpcRequest/DappRpcResponse types, handleDappRpc routing, connected sites CRUD, RPC_ERRORS
  - phase: 04-eth-transactions
    provides: buildAndSignTransaction, rpcCall, estimateGas, getFeeParams, NETWORKS
provides:
  - Pending request queue with chrome.storage.session persistence
  - In-memory callback map for Promise resolution across SW lifetime
  - Approval popup via chrome.windows.create with window-close rejection
  - eth_requestAccounts approval flow (skip if already connected)
  - eth_sendTransaction approval + execution with per-account authorization
  - personal_sign approval + eip191Signer.sign execution
  - eth_signTypedData_v4 approval + signTyped execution
  - Transaction simulation via eth_call balance diff
  - Calldata decoder for common ERC-20/DeFi selectors
  - Permit signature detector for EIP-2612/Permit2
  - SW-restart fallback via chrome.tabs.sendMessage with tabId
affects: [05-03-connection-ui]

# Tech tracking
tech-stack:
  added: []
  patterns: [pending-request-queue, approval-popup, sw-restart-fallback, per-account-authorization]

key-files:
  created:
    - src/features/dapp/pending.ts
    - src/features/dapp/decode.ts
    - src/features/dapp/permit-detect.ts
  modified:
    - src/entrypoints/background.ts
    - src/features/wallet/types.ts
    - src/features/wallet/tx/build.ts

key-decisions:
  - "exactOptionalPropertyTypes requires | undefined on all optional interface fields"
  - "Dynamic import for eip191Signer and signTyped to keep top-level imports clean"
  - "Defense-in-depth: re-verify account authorization in dapp:executeTx handler"
  - "buildAndSignTransaction data field spreads only when non-empty (not '0x')"

patterns-established:
  - "Pending requests in chrome.storage.session + in-memory callbacks for dual persistence"
  - "chrome.windows.create popup reuses existing window (approvalWindowId singleton)"
  - "SW-restart fallback: if callback lost, send via chrome.tabs.sendMessage using stored tabId"
  - "dapp: prefixed messages accepted by wallet listener alongside wallet: prefix"

requirements-completed: [DAPP-03, DAPP-04, DAPP-05, DAPP-06]

# Metrics
duration: 4min
completed: 2026-03-02
---

# Phase 5 Plan 2: Approval Flow Infrastructure Summary

**Pending request queue + approval popup + signing handlers for eth_requestAccounts, eth_sendTransaction, personal_sign, eth_signTypedData_v4 with micro-eth-signer**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-02T09:36:59Z
- **Completed:** 2026-03-02T09:41:40Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Pending request queue persists in chrome.storage.session, survives SW suspension; in-memory callbacks resolve/reject Promises within SW lifetime
- All 4 approval methods (connect, sendTx, personalSign, signTypedData) create pending requests and open approval popup via chrome.windows.create
- Popup-initiated execution: dapp:executeTx builds+signs+sends tx, dapp:signPersonal uses eip191Signer, dapp:signTypedData uses signTyped
- Per-account authorization: signing/tx handlers verify requested account is in origin's authorized account list before proceeding
- SW-restart fallback: if in-memory callback is lost, response delivered via chrome.tabs.sendMessage to content script using stored tabId
- Popup window close rejects all pending requests with code 4001

## Task Commits

1. **Task 1: Pending request queue, calldata decoder, permit detector** - `e85c401` (feat)
2. **Task 2: Wire approval method handlers into background** - `6c6c8c4` (feat)

## Files Created/Modified
- `src/features/dapp/pending.ts` - PendingDappRequest interface, storage CRUD, in-memory callback map
- `src/features/dapp/decode.ts` - Calldata decoder for common ERC-20/DeFi selectors
- `src/features/dapp/permit-detect.ts` - EIP-2612/Permit2 permit signature detection
- `src/entrypoints/background.ts` - Approval popup, 4 approval handlers, 4 execution handlers, simulation
- `src/features/wallet/types.ts` - WalletMessage/WalletResponse extended with 7 dapp: message types
- `src/features/wallet/tx/build.ts` - buildAndSignTransaction accepts optional data field

## Decisions Made
- Used `| undefined` on all optional PendingDappRequest/PermitInfo fields for exactOptionalPropertyTypes compliance
- Dynamic import for eip191Signer and signTyped rather than top-level import to keep module graph clean
- Defense-in-depth pattern: dapp:executeTx re-verifies account authorization against connected site even though approval handler already checked
- buildAndSignTransaction data field uses spread only when non-empty (skips '0x' empty data)
- Wallet listener expanded to accept both `wallet:` and `dapp:` prefixed messages from popup context

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added `| undefined` to optional interface fields for exactOptionalPropertyTypes**
- **Found during:** Task 1 (typecheck)
- **Issue:** TS2375: optional properties without explicit `| undefined` not assignable under exactOptionalPropertyTypes
- **Fix:** Added `| undefined` to PendingDappRequest (params, favicon, title, tabId) and PermitInfo (spender, token, amount, deadline)
- **Files modified:** src/features/dapp/pending.ts, src/features/dapp/permit-detect.ts
- **Verification:** pnpm typecheck passes
- **Committed in:** e85c401 (Task 1), 6c6c8c4 (Task 2)

**2. [Rule 3 - Blocking] Null guard for chrome.windows.create return**
- **Found during:** Task 2 (typecheck)
- **Issue:** TS18048: chrome.windows.create may return undefined window
- **Fix:** Added `if (!popup) return;` guard
- **Files modified:** src/entrypoints/background.ts
- **Verification:** pnpm typecheck passes
- **Committed in:** 6c6c8c4 (Task 2)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both necessary for TS strict mode compliance. No scope creep.

## Issues Encountered
None beyond auto-fixed deviations.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All approval infrastructure ready for connection/approval UI in plan 05-03
- Popup can read pending request via dapp:getPendingRequest message
- Popup can approve (dapp:approve with result) or reject (dapp:reject)
- dapp:executeTx, dapp:signPersonal, dapp:signTypedData, dapp:simulate all functional
- Calldata decoder and permit detector ready for UI display

## Self-Check: PASSED

All 6 files verified present. Both task commits (e85c401, 6c6c8c4) verified in git log.

---
*Phase: 05-dapp-provider-connectivity*
*Completed: 2026-03-02*
