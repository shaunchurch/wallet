---
phase: 03-wallet-core-ui-lifecycle
plan: 01
subsystem: ui
tags: [zustand, react, navigation, onboarding, lock-screen, password-strength]

requires:
  - phase: 02-cryptographic-foundation
    provides: "vault encrypt/decrypt, sendWalletMessage, background message handlers"
provides:
  - "Zustand store with nav stack (push/pop/replace/reset) + wallet state"
  - "Screen renderer architecture (App.tsx -> screen map -> components)"
  - "OnboardingContext for secure mnemonic passing between screens"
  - "Onboarding flow: welcome -> create password -> seed phrase -> confirm -> main"
  - "Import flow: seed entry -> password -> main"
  - "Lock screen with shake animation and lockout countdown (SET-01)"
  - "Popup initialization deriving correct screen from background state (SET-05)"
  - "Password strength utility (3-level, no deps)"
  - "wallet:getLockoutStatus message type"
affects: [03-02, 03-03, 04-transaction-layer]

tech-stack:
  added: []
  patterns:
    - "Zustand store-driven screen rendering (no react-router in popup)"
    - "OnboardingContext for transient seed data (never in zustand)"
    - "Screen map Record<Screen, ComponentType> in App.tsx"

key-files:
  created:
    - src/features/wallet/store.ts
    - src/features/ui/OnboardingContext.tsx
    - src/features/ui/screens/WelcomeScreen.tsx
    - src/features/ui/screens/CreatePasswordScreen.tsx
    - src/features/ui/screens/SeedPhraseScreen.tsx
    - src/features/ui/screens/ConfirmSeedScreen.tsx
    - src/features/ui/screens/ImportSeedScreen.tsx
    - src/features/ui/screens/ImportPasswordScreen.tsx
    - src/features/ui/screens/LockScreen.tsx
    - src/features/ui/screens/MainScreen.tsx
    - src/lib/password-strength.ts
  modified:
    - src/features/ui/App.tsx
    - src/entrypoints/popup.tsx
    - src/features/wallet/types.ts
    - src/entrypoints/background.ts
    - src/styles/globals.css

key-decisions:
  - "OnboardingContext (React context) for mnemonic passing -- not module-level vars, not zustand"
  - "wallet:getLockoutStatus added to types.ts + background handler for lock screen lockout UI"
  - "@scure/bip39/wordlists/english.js (with .js ext) for BIP-39 wrong answer options"
  - "CSS @utility animate-shake for lock screen error feedback"
  - "useEffect + ref.focus() instead of autoFocus attribute (biome a11y compliance)"

patterns-established:
  - "Screen components are pure React, import useWalletStore selectors for nav/state"
  - "Password forms: show/hide toggle, strength meter (3 segments), min 8 char validation"
  - "Background message round-trips: send message -> check response type -> update store"

requirements-completed: [SET-01, SET-05]

duration: 5min
completed: 2026-03-01
---

# Phase 3 Plan 1: Zustand Store + Onboarding + Lock Screen Summary

**Store-driven navigation with complete onboarding flows (create/import), lock screen with shake/lockout, and popup initialization from background state**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-01T15:39:04Z
- **Completed:** 2026-03-01T15:44:28Z
- **Tasks:** 2
- **Files modified:** 19

## Accomplishments
- Zustand store manages all popup navigation and wallet state; App.tsx renders screens from store
- Complete create flow: password (strength meter, min 8 chars) -> seed phrase (3x4 grid, no copy) -> 3-word confirmation (4-choice each)
- Complete import flow: seed entry (12/24 words) -> password -> main
- Lock screen: shake animation on wrong password, inline lockout countdown, programmatic focus
- Popup initialization queries background to derive correct start screen (no vault -> welcome, locked -> lock, unlocked -> main)
- Seed phrase never in zustand store -- OnboardingContext (React context) only

## Task Commits

1. **Task 1: Zustand store, App screen renderer, popup entry cleanup** - `29e029b` (feat)
2. **Task 2: Onboarding screens + lock screen** - `6b7da2d` (feat)

## Files Created/Modified
- `src/features/wallet/store.ts` - Zustand store: nav stack, wallet state, initialize()
- `src/features/ui/App.tsx` - Screen renderer driven by store, OnboardingProvider wrapper
- `src/features/ui/OnboardingContext.tsx` - React context for transient mnemonic/address
- `src/entrypoints/popup.tsx` - Removed MemoryRouter, renders App directly
- `src/lib/password-strength.ts` - 3-level password strength calculator
- `src/features/ui/screens/WelcomeScreen.tsx` - Logo + Create/Import buttons
- `src/features/ui/screens/CreatePasswordScreen.tsx` - Password + strength meter
- `src/features/ui/screens/SeedPhraseScreen.tsx` - 3x4 numbered word grid
- `src/features/ui/screens/ConfirmSeedScreen.tsx` - 3 random word challenges from BIP-39 wordlist
- `src/features/ui/screens/ImportSeedScreen.tsx` - Seed phrase textarea entry
- `src/features/ui/screens/ImportPasswordScreen.tsx` - Password for import flow
- `src/features/ui/screens/LockScreen.tsx` - Unlock with shake + lockout countdown
- `src/features/ui/screens/MainScreen.tsx` - Placeholder wrapping existing Header/Balance/Actions
- `src/features/wallet/types.ts` - Added wallet:getLockoutStatus message + lockoutStatus response
- `src/entrypoints/background.ts` - Added handleGetLockoutStatus handler
- `src/styles/globals.css` - Added shake keyframe + animate-shake utility

## Decisions Made
- OnboardingContext (React context) chosen over module-level variables for mnemonic transport -- scoped to component tree, GC'd on unmount
- Added `wallet:getLockoutStatus` message type to types.ts and handler in background.ts -- lock screen needs lockout state from background to show countdown
- Used `@scure/bip39/wordlists/english.js` (.js extension required by v2 exports map) for BIP-39 wordlist in seed confirmation wrong answers
- Replaced `autoFocus` with `useEffect` + `ref.focus()` for biome a11y compliance
- CSS `@utility animate-shake` via Tailwind v4 utility syntax for lock screen error animation

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added wallet:getLockoutStatus message type and handler**
- **Found during:** Task 2 (LockScreen implementation)
- **Issue:** Plan references `wallet:getLockoutStatus` in LockScreen but message type didn't exist in types.ts or background.ts
- **Fix:** Added message type to WalletMessage union, response type to WalletResponse union, and handler function in background.ts
- **Files modified:** src/features/wallet/types.ts, src/entrypoints/background.ts
- **Verification:** typecheck passes, lock screen can query lockout state
- **Committed in:** 6b7da2d (Task 2 commit)

**2. [Rule 1 - Bug] Fixed @scure/bip39 wordlist import path**
- **Found during:** Task 2 (ConfirmSeedScreen)
- **Issue:** Import `@scure/bip39/wordlists/english` failed -- v2 exports map requires `.js` extension
- **Fix:** Changed to `@scure/bip39/wordlists/english.js`
- **Files modified:** src/features/ui/screens/ConfirmSeedScreen.tsx
- **Verification:** typecheck passes
- **Committed in:** 6b7da2d (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 bug)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered
- Biome import ordering auto-fixed via `pnpm lint:fix` across 7 files
- `autoFocus` attribute flagged by biome a11y rule -- replaced with useEffect ref focus

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Store-driven navigation architecture established; plans 03-02 and 03-03 can add screens by registering in the screen map
- MainScreen is a placeholder wrapping existing Phase 1 components -- ready for Phantom-style redesign in 03-02
- Settings, About, Receive screens are stubs -- to be implemented in 03-02/03-03
- OnboardingContext pattern available for any future screen-to-screen transient data

## Self-Check: PASSED

All 13 created files verified on disk. Both task commits (29e029b, 6b7da2d) verified in git log.

---
*Phase: 03-wallet-core-ui-lifecycle*
*Completed: 2026-03-01*
