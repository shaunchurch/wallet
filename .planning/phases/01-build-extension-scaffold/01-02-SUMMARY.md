---
phase: 01-build-extension-scaffold
plan: 02
subsystem: ui
tags: [tailwindcss, shadcn, react, chrome-extension, vitest, dark-mode, esbuild]

requires:
  - phase: 01-build-extension-scaffold/01-01
    provides: esbuild pipeline, manifest, entrypoints, postcss plugin
provides:
  - Styled placeholder popup (header, balance, action buttons)
  - Light/dark theme toggle via ThemeProvider
  - shadcn/ui Button component with zinc palette
  - Deterministic build verification test (SHA-256)
  - Version pin enforcement test
affects: [03-wallet-core-ui, ui-components]

tech-stack:
  added: [shadcn-ui, vitest]
  patterns: [feature-folder-components, theme-context-provider, class-based-dark-mode]

key-files:
  created:
    - src/features/ui/ThemeProvider.tsx
    - src/features/ui/components/Header.tsx
    - src/features/ui/components/BalancePlaceholder.tsx
    - src/features/ui/components/ActionButtons.tsx
    - src/components/ui/button.tsx
    - components.json
    - tests/build.test.ts
    - tests/pins.test.ts
    - vitest.config.ts
  modified:
    - src/features/ui/App.tsx
    - src/styles/globals.css

key-decisions:
  - "Tailwind v4 @custom-variant for class-based dark mode (not media query)"
  - "Manual shadcn button component copy (CLI init incompatible with esbuild)"
  - "SHA-256 recursive dir hashing for deterministic build verification"

patterns-established:
  - "ThemeProvider context with localStorage persistence and system preference default"
  - "Feature-folder component organization: features/ui/components/"
  - "shadcn/ui components at src/components/ui/ with @/components alias"

requirements-completed: [BUILD-04, BUILD-06]

duration: 8min
completed: 2026-03-01
---

# Phase 1 Plan 2: Styled Popup UI & Build Verification Summary

**Placeholder popup with light/dark theme toggle, shadcn button components, and vitest deterministic build + pin verification tests**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-01
- **Completed:** 2026-03-01
- **Tasks:** 3 (2 auto + 1 checkpoint with bugfix)
- **Files modified:** 13

## Accomplishments
- Styled 360x600 popup: header with vibewallet branding, balance placeholder, send/receive buttons
- Working light/dark theme toggle with localStorage persistence
- Deterministic build test proving byte-identical output
- Version pin test enforcing zero ^ or ~ in package.json

## Task Commits

Each task was committed atomically:

1. **Task 1: Styled placeholder popup with light/dark theme** - `2be743d` (feat)
2. **Task 2: Deterministic build and version pin verification tests** - `9d3502a` (test)
3. **Task 3: Fix dark mode toggle** - `833f6c7` (fix)

## Files Created/Modified
- `src/features/ui/ThemeProvider.tsx` - Theme context with toggle, localStorage, system preference
- `src/features/ui/components/Header.tsx` - Header bar with vibewallet branding and theme toggle button
- `src/features/ui/components/BalancePlaceholder.tsx` - Placeholder balance display (0.00 ETH / $0.00)
- `src/features/ui/components/ActionButtons.tsx` - Disabled Send/Receive buttons with violet accent
- `src/features/ui/App.tsx` - Main popup layout composing all components
- `src/components/ui/button.tsx` - shadcn/ui Button with variants
- `components.json` - shadcn/ui configuration
- `src/styles/globals.css` - Tailwind theme vars, dark mode vars, @custom-variant for class-based dark
- `vitest.config.ts` - Vitest config with 60s timeout and @ alias
- `tests/build.test.ts` - Deterministic build verification via SHA-256 hashing
- `tests/pins.test.ts` - Version pin + lockfile integrity tests

## Decisions Made
- Tailwind v4 uses `@custom-variant dark (&:where(.dark, .dark *))` for class-based dark mode (default is media query)
- Manual shadcn button copy instead of CLI init (esbuild not supported by shadcn init)
- SHA-256 recursive directory hashing with sorted file traversal for deterministic comparison

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed dark mode toggle not working**
- **Found during:** Task 3 (checkpoint verification feedback)
- **Issue:** Tailwind CSS v4 defaults to `@media (prefers-color-scheme: dark)` for `dark:` variants. ThemeProvider toggles `.dark` class on `<html>`, but Tailwind ignored it.
- **Fix:** Added `@custom-variant dark (&:where(.dark, .dark *));` to globals.css to use class-based dark mode
- **Files modified:** src/styles/globals.css
- **Verification:** Build output has 31 `.dark` class selectors, 0 `prefers-color-scheme` queries. Typecheck, lint, tests all pass.
- **Committed in:** `833f6c7`

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential fix for core feature. No scope creep.

## Issues Encountered
None beyond the dark mode bug caught during manual verification.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Extension scaffold fully complete with styled UI, working theme, passing tests
- Ready for Phase 2: Cryptographic Foundation (key derivation, vault encryption)
- UI component patterns established for Phase 3 wallet UI expansion

## Self-Check: PASSED

All 11 files verified present. All 3 commits verified in git log.

---
*Phase: 01-build-extension-scaffold*
*Completed: 2026-03-01*
