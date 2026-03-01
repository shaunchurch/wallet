---
phase: 03-wallet-core-ui-lifecycle
plan: 02
subsystem: ui
tags: [react, zustand, qrcode, jazzicon, svg, chrome-extension, sidebar, multi-account]

requires:
  - phase: 03-01
    provides: zustand store, screen navigation, lock screen
provides:
  - Phantom-style main wallet screen with balance and action buttons
  - Sidebar account switcher with add/switch/rename/lock
  - ReceiveScreen with QR code and clipboard copy (ACCT-03)
  - Jazzicon deterministic SVG avatar from ETH address
  - Adaptive Header (avatar/back-nav/branding modes)
  - Multi-account derivation with persistence across lock/unlock (ACCT-02)
  - Account name editing persisted to chrome.storage.local
affects: [03-03, 04-send-transactions, 06-balance-display, 08-token-list]

tech-stack:
  added: [qrcode.react@4.2.0]
  patterns: [sidebar-overlay-css, jazzicon-prng, derivedIndices-persistence]

key-files:
  created:
    - src/lib/jazzicon.tsx
    - src/features/ui/components/Sidebar.tsx
  modified:
    - src/features/ui/screens/MainScreen.tsx
    - src/features/ui/screens/ReceiveScreen.tsx
    - src/features/ui/components/Header.tsx
    - src/features/ui/components/ActionButtons.tsx
    - src/features/ui/components/BalancePlaceholder.tsx
    - src/features/wallet/store.ts
    - src/entrypoints/background.ts

key-decisions:
  - "Jazzicon key from rect coordinates instead of array index (biome noArrayIndexKey)"
  - "Sidebar overlay as <button> for a11y compliance (not div+role)"
  - "derivedIndices stored in chrome.storage.local, cleared on create/import"
  - "Network preference persisted in setNetwork action"

patterns-established:
  - "Sidebar CSS animation pattern: .sidebar-overlay/.sidebar-panel with data-open attribute"
  - "Header mode detection via currentScreen from store (not props)"
  - "Account name persistence: chrome.storage.local 'accountNames' key"

requirements-completed: [ACCT-02, ACCT-03]

duration: 5min
completed: 2026-03-01
---

# Phase 3 Plan 2: Main Wallet Screen + Sidebar + Receive Summary

**Phantom-style main screen with jazzicon avatar, sidebar account switcher (add/switch/rename), receive screen with QR code via qrcode.react, and multi-account derivation persisted across lock/unlock**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-01T15:47:34Z
- **Completed:** 2026-03-01T15:53:20Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- MainScreen with Phantom-style layout: balance area, 3 action buttons (Send disabled, Receive active, Buy disabled), token placeholder
- Sidebar with account list (jazzicon + name + address), add account, rename via double-click, lock wallet, settings link
- ReceiveScreen with QRCodeSVG (200px), full address display, copy-to-clipboard with "Copied!" feedback
- Jazzicon hand-rolled SVG avatar (~90 lines): deterministic from address via PRNG, unique clipPath IDs
- Header 3-mode system: avatar+network pill on main, back arrow+title on sub-screens, branding on onboarding/lock
- Background: derivedIndices persistence -- accounts survive lock/unlock cycles; cleared on new wallet create/import

## Task Commits

1. **Task 1: Install qrcode.react, build jazzicon, update Header + store + CSS** - `bc47322` (feat)
2. **Task 2: MainScreen, Sidebar, ReceiveScreen, ActionButtons, background persistence** - `2819e27` (feat)

## Files Created/Modified
- `src/lib/jazzicon.tsx` - Deterministic SVG avatar from ETH address
- `src/features/ui/components/Sidebar.tsx` - Slide-from-left account switcher drawer
- `src/features/ui/screens/MainScreen.tsx` - Phantom-style main wallet screen
- `src/features/ui/screens/ReceiveScreen.tsx` - QR code + address display + copy
- `src/features/ui/components/Header.tsx` - 3-mode header (avatar/back-nav/branding)
- `src/features/ui/components/ActionButtons.tsx` - Circular icon buttons (Send/Receive/Buy)
- `src/features/ui/components/BalancePlaceholder.tsx` - Balance display (0 ETH placeholder)
- `src/features/wallet/store.ts` - closeSidebar, accountNames, network persist
- `src/entrypoints/background.ts` - derivedIndices persistence, restore on unlock
- `src/styles/globals.css` - Sidebar overlay/panel animation CSS
- `package.json` - qrcode.react@4.2.0 added
- `pnpm-lock.yaml` - lockfile updated

## Decisions Made
- Jazzicon uses rect coordinate-based keys instead of array index (biome lint compliance)
- Sidebar overlay implemented as `<button>` element for a11y (biome useSemanticElements)
- derivedIndices stored in chrome.storage.local, cleared on create/import to prevent stale indices from previous wallet
- Network preference persisted on toggle via chrome.storage.local
- Removed unused ONBOARDING_SCREENS constant (Header mode falls through to default)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Biome lint formatting and a11y compliance**
- **Found during:** Task 2
- **Issue:** Long SVG attribute lines, import ordering, span with role="button", array index keys
- **Fix:** Ran biome --write for formatting; changed span to button for a11y; used coordinate-based keys for jazzicon rects
- **Files modified:** All new component files
- **Verification:** `pnpm lint` passes clean

---

**Total deviations:** 1 auto-fixed (lint/a11y compliance)
**Impact on plan:** Minor formatting adjustments. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Main wallet experience functional: view address, copy, QR code, switch accounts, derive new accounts, lock
- Ready for 03-03 (auto-lock timer, settings screen, about screen)
- Send/Buy buttons wired as disabled placeholders for Phase 4+

---
*Phase: 03-wallet-core-ui-lifecycle*
*Completed: 2026-03-01*
