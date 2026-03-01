---
phase: 03-wallet-core-ui-lifecycle
plan: 03
subsystem: ui, security
tags: [chrome.alarms, auto-lock, seed-export, settings, react, mv3]

requires:
  - phase: 03-01
    provides: onboarding screens, seed phrase grid pattern, zustand store
  - phase: 03-02
    provides: main screen, header, sidebar, network pill

provides:
  - Auto-lock via chrome.alarms (SEC-08)
  - Seed phrase export with password re-entry (SEC-09)
  - Settings screen with grouped sections
  - Configurable auto-lock timeout (SET-02)
  - Network persistence toggle (SET-03)
  - About page with version/links (SET-04)
  - Heartbeat-based inactivity detection
  - Ready-promise gate for SW init race prevention

affects: [04-transaction-layer, 05-dapp-integration]

tech-stack:
  added: [chrome.alarms API]
  patterns: [ready-promise gate, throttled heartbeat, state-machine modal]

key-files:
  created:
    - src/features/ui/components/SeedExportModal.tsx
  modified:
    - public/manifest.json
    - src/features/wallet/types.ts
    - src/entrypoints/background.ts
    - src/features/ui/screens/SettingsScreen.tsx
    - src/features/ui/screens/AboutScreen.tsx
    - src/features/wallet/store.ts
    - src/features/ui/App.tsx
    - tests/crypto/integration.test.ts

key-decisions:
  - "Ready-promise pattern gates all message handling until lockout restore + alarm check complete"
  - "Heartbeat throttled to 60s to avoid message spam between popup and background"
  - "SeedExportModal uses 3-step state machine: password -> warning -> reveal"
  - "Mnemonic stored in component-local state only, never in zustand store"
  - "chrome.alarms mock added to test infrastructure for alarm lifecycle testing"

patterns-established:
  - "Ready-promise gate: async IIFE that completes before any message is processed"
  - "State-machine modal: step-based UI flow with cleanup on close/unmount"
  - "Throttled heartbeat: document event listeners with timestamp-based debounce"

requirements-completed: [SEC-08, SEC-09, SET-02, SET-03, SET-04]

duration: 7min
completed: 2026-03-01
---

# Phase 3 Plan 3: Settings, Auto-lock & Seed Export Summary

**Auto-lock via chrome.alarms with heartbeat inactivity detection, seed export behind password re-entry + warning, settings screen with timeout config and network toggle, about page**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-01T15:56:27Z
- **Completed:** 2026-03-01T16:04:00Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments
- Auto-lock alarm system: created on unlock/import/confirm, cleared on lock, re-registered on SW restart
- Heartbeat-based true inactivity timeout -- alarm resets on user interaction (throttled 60s)
- Ready-promise gates message handling until lockout restoration and alarm check complete
- Seed export modal with password verification -> warning -> 3x4 grid reveal flow
- Settings screen with iOS-style grouped sections (Security, Network, About)
- 16 new integration tests covering all new message handlers

## Task Commits

Each task was committed atomically:

1. **Task 1: Auto-lock alarm system, new message types, seed export handler** - `1669757` (feat)
2. **Task 2: Settings screen, About page, Seed export modal, heartbeat** - `9c3af86` (feat)
3. **Task 3: Automated tests for new message handlers** - `9fc7c48` (test)

## Files Created/Modified
- `public/manifest.json` - Added alarms permission
- `src/features/wallet/types.ts` - 5 new message types + 4 new response types
- `src/entrypoints/background.ts` - Auto-lock alarm system, seed export handler, heartbeat, ready-promise gate
- `src/features/ui/screens/SettingsScreen.tsx` - Grouped settings with auto-lock dropdown, seed export trigger, network toggle
- `src/features/ui/screens/AboutScreen.tsx` - Version, source code, security contact, issue links
- `src/features/ui/components/SeedExportModal.tsx` - 3-step password-gated seed reveal modal
- `src/features/wallet/store.ts` - autoLockMinutes field + loading in initialize
- `src/features/ui/App.tsx` - Throttled heartbeat on user interaction events
- `tests/crypto/integration.test.ts` - 16 new tests + chrome.alarms mock infrastructure

## Decisions Made
- Ready-promise pattern: async IIFE at module level ensures restoreLockout() + alarm re-registration complete before any message is processed
- Heartbeat throttled to 60s (HEARTBEAT_THROTTLE_MS) to avoid message spam
- SeedExportModal uses component-local state for mnemonic, never zustand store (defense-in-depth)
- Password re-entry for seed export separate from unlock (clear intent separation, audit trail)
- Storage mock updated to support array keys for multi-key `chrome.storage.local.get()`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Biome formatting for ternary expressions**
- **Found during:** Task 2
- **Issue:** Biome formatter required single-line ternaries and shorter JSX attribute lines
- **Fix:** Reformatted ternary in background.ts and JSX in SeedExportModal.tsx
- **Files modified:** src/entrypoints/background.ts, src/features/ui/components/SeedExportModal.tsx
- **Committed in:** 9c3af86

**2. [Rule 1 - Bug] Unused variables in tests**
- **Found during:** Task 3
- **Issue:** Biome lint flagged unused `mnemonic` and `beforeAlarm` variables
- **Fix:** Removed assignment for unused `mnemonic`, replaced `beforeAlarm` with comment
- **Files modified:** tests/crypto/integration.test.ts
- **Committed in:** 9fc7c48

**3. [Rule 1 - Bug] Lockout state persistence across test runs**
- **Found during:** Task 3
- **Issue:** Module-level lockout manager state leaked between tests (shared across describes)
- **Fix:** Restructured lockout tests to use relative assertions and ensure clean state via successful unlock before testing
- **Files modified:** tests/crypto/integration.test.ts
- **Committed in:** 9fc7c48

---

**Total deviations:** 3 auto-fixed (3 bugs)
**Impact on plan:** All fixes for correctness. No scope creep.

## Issues Encountered
None beyond the auto-fixed items above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 3 complete: all UI lifecycle, settings, and security features implemented
- Auto-lock, seed export, settings, and about screens are fully functional
- Ready for Phase 4 (transaction layer) or Phase 5 (dApp integration)
- 104 tests passing, full typecheck/build/lint clean

## Self-Check: PASSED

All 9 files verified present. All 3 task commits verified (1669757, 9c3af86, 9fc7c48). Alarms permission and onAlarm listener confirmed in place.

---
*Phase: 03-wallet-core-ui-lifecycle*
*Completed: 2026-03-01*
