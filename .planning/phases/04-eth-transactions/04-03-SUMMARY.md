---
phase: 04-eth-transactions
plan: 03
subsystem: ui
tags: [react, zustand, send-flow, balance-display, gas-estimation, coingecko]

requires:
  - phase: 04-eth-transactions
    provides: "Transaction backend: RPC, gas estimation, tx signing, message handlers"
  - phase: 03-wallet-ui
    provides: "Zustand store, screen navigation, Header/Sidebar/ActionButtons"
provides:
  - "4-screen send flow: recipient -> amount -> confirm -> result"
  - "Real ETH balance display with fiat conversion and shimmer loading"
  - "Address validation via micro-eth-signer addr module"
  - "Recent addresses from chrome.storage.local"
  - "Send flow state in zustand store"
affects: [05-dapp-connector, 06-real-time-streaming, 08-token-ecosystem]

tech-stack:
  added: []
  patterns: [pure formatter extraction for popup bundle safety, card-style confirmation layout]

key-files:
  created:
    - src/features/ui/components/BalanceDisplay.tsx
    - src/features/ui/screens/SendRecipientScreen.tsx
    - src/features/ui/screens/SendAmountScreen.tsx
    - src/features/ui/screens/SendConfirmScreen.tsx
    - src/features/ui/screens/SendResultScreen.tsx
    - src/features/wallet/tx/format.ts
  modified:
    - src/features/wallet/store.ts
    - src/features/ui/App.tsx
    - src/features/ui/components/ActionButtons.tsx
    - src/features/ui/components/Header.tsx
    - src/features/ui/screens/MainScreen.tsx
    - src/features/wallet/tx/build.ts
    - src/features/wallet/tx/index.ts

key-decisions:
  - "Pure formatters extracted to tx/format.ts to avoid pulling micro-eth-signer crypto into popup bundle"
  - "validateAddress still imported from build.ts (pulls micro-eth-signer into popup ~1.4mb total, acceptable for wallet)"
  - "Send flow state in zustand, clearSendState on cancel/done to prevent stale data"

patterns-established:
  - "Pure formatter module pattern: tx/format.ts has no crypto deps, safe for any bundle"
  - "Send flow state pattern: sendTo/sendAmountWei/sendResult in zustand, cleared on flow exit"

requirements-completed: [TX-01, TX-02, TX-06]

duration: 27min
completed: 2026-03-01
---

# Phase 4 Plan 03: Send Flow UI Summary

**4-screen ETH send flow (recipient/amount/confirm/result) + real balance display with fiat conversion replacing placeholder**

## Performance

- **Duration:** 27 min
- **Started:** 2026-03-01T22:17:18Z
- **Completed:** 2026-03-01T22:44:21Z
- **Tasks:** 2 (of 3, checkpoint pending)
- **Files modified:** 13

## Accomplishments
- Real ETH balance with CoinGecko fiat conversion replaces hardcoded placeholder
- Shimmer skeleton loading animation while balance fetches
- Send button enabled, navigates through 4-screen flow
- Address validation with checksum/length/format checks + recent addresses
- Amount screen with ETH/fiat toggle, Max button (gas-aware)
- Card-style confirmation with expandable gas details
- Spinner + "Sending..." on confirm, success/failure result screens
- Explorer link on success, Try Again on failure

## Task Commits

1. **Task 1: Store + BalanceDisplay + wiring** - `7e95234` (feat)
2. **Task 2: All 4 send flow screens** - `15f96dc` (feat)

## Files Created/Modified
- `src/features/wallet/tx/format.ts` - Pure formatters (formatEth, formatUsd, parseEthToWei, calculateMaxSend) -- no crypto deps
- `src/features/ui/components/BalanceDisplay.tsx` - Real balance + fiat + shimmer skeleton
- `src/features/ui/screens/SendRecipientScreen.tsx` - Address input + validation + recent addresses
- `src/features/ui/screens/SendAmountScreen.tsx` - ETH/fiat toggle, Max button, balance validation
- `src/features/ui/screens/SendConfirmScreen.tsx` - Card layout, gas details, spinner on submit
- `src/features/ui/screens/SendResultScreen.tsx` - Success/failure with explorer link + retry
- `src/features/wallet/store.ts` - Send screen types + send flow state (sendTo, sendAmountWei, sendResult)
- `src/features/ui/App.tsx` - Register 4 send screens in router
- `src/features/ui/components/ActionButtons.tsx` - Enable Send button with navigation
- `src/features/ui/components/Header.tsx` - Send screens in SUB_SCREENS + SCREEN_TITLES
- `src/features/ui/screens/MainScreen.tsx` - BalanceDisplay replaces BalancePlaceholder
- `src/features/wallet/tx/build.ts` - Re-exports formatters from format.ts
- `src/features/wallet/tx/index.ts` - Updated barrel exports

## Decisions Made
- Extracted pure formatters (formatEth, formatUsd, parseEthToWei, calculateMaxSend) to tx/format.ts to avoid pulling micro-eth-signer crypto into popup bundle
- validateAddress stays in build.ts (needs addr from micro-eth-signer), popup bundle grows to ~1.4mb but acceptable for wallet extension
- Send flow state (sendTo, sendAmountWei, sendAmountEth, sendResult) stored in zustand, cleared via clearSendState on cancel/done
- SendConfirmScreen uses push to send-result (not replace) so Try Again can pop back

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Created tx/format.ts for popup-safe formatters**
- **Found during:** Task 1 (BalanceDisplay)
- **Issue:** Plan noted potential bundle issues importing from build.ts (pulls micro-eth-signer)
- **Fix:** Extracted pure math formatters to format.ts, build.ts re-exports for backward compat
- **Files modified:** src/features/wallet/tx/format.ts, build.ts, index.ts
- **Committed in:** 7e95234

---

**Total deviations:** 1 auto-fixed (Rule 2 - architecture safeguard)
**Impact on plan:** Planned contingency -- plan explicitly mentioned this approach. No scope creep.

## Issues Encountered
- Pre-existing lint formatting errors in Sidebar.tsx, AboutScreen.tsx, SettingsScreen.tsx, store.ts, test files from prior phases. Out of scope per deviation rules.

## Post-Review Fixes (2026-03-02)

Code review identified 4 bugs (2×P1, 1×P2, 1×P3). All fixed:

**P1: USD input silently treated as ETH when price unavailable**
- `getEthAmount()` fell through to return raw USD value as ETH when `ethPrice` was null/0
- Fix: return 0 when USD mode and price unavailable

**P1: parseFloat precision loss in wei conversion**
- ETH mode round-tripped through `parseFloat→toFixed(18)→parseEthToWei`, losing precision for high-decimal inputs
- Fix: pass `ethInput` string directly to `parseEthToWei()` in ETH mode (lossless). USD mode retains float division (inherent to fiat, acceptable)

**P2: Amount validation ignores gas for non-Max flows**
- Plan required `amount + gas <= balance` validation; only `amount <= balance` was checked
- Fix: fetch gas estimate on mount, validate `amount + estimatedGas > balance` → "Insufficient balance for gas"

**P3: BalanceDisplay float-based precision drift**
- `BigInt(Math.round(parseFloat(balanceEth) * 1e18))` lost precision for exact wei values
- Fix: use `parseEthToWei(balanceEth)` for lossless string→bigint conversion

**Review findings not actioned:**
- TEST-03 signed-hex comparison: unsigned RLP match is correct (signing uses extraEntropy → non-deterministic signed hex)
- Checkpoint state: process/doc issue, not code defect

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All ETH transaction UI is complete (send flow + balance display)
- Phase 4 fully implements send/receive ETH with megaETH-correct gas
- Ready for Phase 5 (dapp connector) and Phase 6 (real-time streaming)

## Self-Check: PASSED

All 6 created files verified present. Both task commits (7e95234, 15f96dc) verified in git log.

---
*Phase: 04-eth-transactions*
*Completed: 2026-03-01*
*Reviewed: 2026-03-02*
