---
phase: 01-build-extension-scaffold
plan: 01
subsystem: build
tags: [esbuild, chrome-extension, mv3, tailwindcss, react, biome, postcss]

requires:
  - phase: none
    provides: greenfield project
provides:
  - MV3 Chrome extension scaffold with strict CSP
  - esbuild multi-bundle pipeline (4 entrypoints)
  - Tailwind v4 + PostCSS integration
  - React popup app with MemoryRouter
  - Biome lint + TypeScript strict type checking
affects: [01-02, 02-cryptographic-foundation, 03-wallet-core-ui]

tech-stack:
  added: [react@19.2.4, react-dom@19.2.4, react-router@7.13.1, zustand@5.0.11, esbuild@0.27.3, tailwindcss@4.2.1, "@tailwindcss/postcss@4.2.1", postcss@8.5.6, typescript@5.9.3, "@biomejs/biome@2.4.4", vitest@4.0.18, tsx@4.21.0, clsx@2.1.1, tailwind-merge@3.5.0, class-variance-authority@0.7.1]
  patterns: [multi-call esbuild builds, PostCSS plugin for esbuild, content script inpage injection, cn() utility]

key-files:
  created: [package.json, scripts/build.ts, scripts/postcss-plugin.ts, public/manifest.json, public/popup.html, src/entrypoints/background.ts, src/entrypoints/content.ts, src/entrypoints/inpage.ts, src/entrypoints/popup.tsx, src/styles/globals.css, src/lib/utils.ts, src/features/ui/App.tsx, tsconfig.json, biome.json, .npmrc, .gitignore]
  modified: []

key-decisions:
  - "Biome 2.4.4 uses 'includes' not 'include' in overrides; schema updated to match installed version"
  - "pnpm onlyBuiltDependencies for esbuild native binary approval"
  - "Parallel esbuild.build() calls for faster builds"

patterns-established:
  - "Multi-call esbuild: separate build() per entrypoint format (ESM/IIFE)"
  - "PostCSS plugin: inline esbuild plugin processes CSS through @tailwindcss/postcss"
  - "Content script injection: createElement script + chrome.runtime.getURL for inpage"
  - "cn() helper: clsx + tailwind-merge for className composition"

requirements-completed: [BUILD-01, BUILD-02, BUILD-03, BUILD-05]

duration: 4min
completed: 2026-03-01
---

# Phase 1 Plan 01: Project Scaffold Summary

**MV3 extension scaffold with esbuild 4-bundle pipeline (background ESM, content/inpage IIFE, popup ESM+React), Tailwind v4 PostCSS, strict CSP, exact-pinned deps**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-01T12:17:28Z
- **Completed:** 2026-03-01T12:21:26Z
- **Tasks:** 2
- **Files modified:** 24

## Accomplishments
- MV3 manifest with strict CSP blocking inline/eval/remote
- esbuild produces 4 bundles in correct formats (ESM for background+popup, IIFE for content+inpage)
- All 18 deps exact-pinned (zero ^ or ~)
- Tailwind v4 CSS processing via custom PostCSS esbuild plugin
- TypeScript strict mode + Biome linting both pass

## Task Commits

1. **Task 1: Initialize project with configs and dependencies** - `bd3c63d` (feat)
2. **Task 2: Create esbuild build script and all entrypoint source files** - `c59e233` (feat)

## Files Created/Modified
- `package.json` - Project deps with exact pins, scripts
- `.npmrc` - save-exact=true
- `tsconfig.json` - ES2022, strict, bundler moduleResolution, path aliases
- `biome.json` - Lint + format config for Biome 2.4.4
- `.gitignore` - node_modules, dist, tsbuildinfo
- `public/manifest.json` - MV3 manifest with strict CSP, service worker, content scripts
- `public/popup.html` - CSP-compliant popup shell (no inline scripts)
- `public/icons/*.png` - Placeholder purple icons (16/32/48/128)
- `scripts/build.ts` - Multi-call esbuild pipeline with watch mode support
- `scripts/postcss-plugin.ts` - esbuild plugin bridging PostCSS + Tailwind v4
- `src/entrypoints/background.ts` - Service worker placeholder
- `src/entrypoints/content.ts` - Inpage.js injection via chrome.runtime.getURL
- `src/entrypoints/inpage.ts` - MAIN world placeholder (EIP-1193 in Phase 5)
- `src/entrypoints/popup.tsx` - React entry with StrictMode + MemoryRouter
- `src/styles/globals.css` - Tailwind v4 @import with purple accent theme
- `src/lib/utils.ts` - cn() helper (clsx + tailwind-merge)
- `src/features/ui/App.tsx` - Minimal placeholder React component

## Decisions Made
- Biome 2.4.4 schema differs from research (2.4.2): `ignore` removed from `files`, `include` -> `includes` in overrides
- Used `pnpm.onlyBuiltDependencies` in package.json to approve esbuild native binary builds
- Ran esbuild.build() calls in parallel via Promise.all for faster builds

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed biome.json schema for v2.4.4**
- **Found during:** Task 2 (lint verification)
- **Issue:** Research biome.json used `ignore` key (removed in 2.4.4) and `include` (renamed to `includes`)
- **Fix:** Updated schema version to 2.4.4, removed `ignore`, changed `include` to `includes`
- **Files modified:** biome.json
- **Verification:** `pnpm lint` passes
- **Committed in:** c59e233 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor config correction. No scope creep.

## Issues Encountered
- esbuild native binary required `pnpm approve-builds` which is interactive; worked around by adding `pnpm.onlyBuiltDependencies` to package.json

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Build pipeline complete, `pnpm build` produces loadable Chrome extension
- Ready for Plan 02: styled placeholder popup UI + deterministic build tests
- All entrypoints produce correct bundle formats

## Self-Check: PASSED

All 15 key files verified present. Both task commits (bd3c63d, c59e233) confirmed in git log.

---
*Phase: 01-build-extension-scaffold*
*Completed: 2026-03-01*
