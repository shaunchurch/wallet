---
phase: 01-build-extension-scaffold
verified: 2026-03-01T12:45:00Z
status: human_needed
score: 4/5 must-haves verified
re_verification: false
human_verification:
  - test: "Load dist/ as unpacked extension in Chrome. Click toolbar icon."
    expected: "Popup opens at ~360x600 showing header with 'megawallet' + sun/moon toggle, '0.00 ETH' balance area, disabled Send/Receive buttons. No CSP errors in DevTools console."
    why_human: "Visual rendering and CSP violation absence require live Chrome environment"
  - test: "Click the theme toggle button in the popup header."
    expected: "UI switches between light and dark mode. Toggle icon changes between sun and moon."
    why_human: "React state / DOM class mutation requires interactive browser session"
  - test: "Open chrome://extensions -> megawallet -> 'Service worker' link."
    expected: "Console shows '[megawallet] background service worker started'"
    why_human: "Service worker console output requires live Chrome environment"
---

# Phase 1: Build & Extension Scaffold Verification Report

**Phase Goal:** Extension loads in Chrome with correct MV3 manifest, strict CSP, and reproducible multi-bundle build
**Verified:** 2026-03-01T12:45:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Extension installs in Chrome from local build and shows popup with placeholder UI | ? NEEDS HUMAN | dist/ complete with all assets; visual confirmation requires Chrome |
| 2 | esbuild produces separate bundles: background (ESM), content (IIFE), popup (ESM), inpage (IIFE) | VERIFIED | background.js: no IIFE wrapper (raw statements); content.js: `"use strict";(()=>{...})()` IIFE; inpage.js: `"use strict";(()=>{...})()` IIFE; popup.js: ESM (var/function declarations, no IIFE) |
| 3 | CSP blocks inline scripts, eval, Function, and remote code loading | VERIFIED | manifest.json: `"extension_pages": "script-src 'self'; object-src 'self';"` — no `'unsafe-inline'`, no `'unsafe-eval'`, no remote URL. popup.html has no inline scripts. Zero eval()/Function() in all source files. |
| 4 | Two consecutive builds from same source produce identical output (byte-for-byte) | VERIFIED | `pnpm test` passes: `tests/build.test.ts` runs two `pnpm build:prod` calls and SHA-256 hashes dist/ recursively, asserting equality. Build script uses only static defines (no Date.now, no timestamps). |
| 5 | package.json has zero `^` or `~` version specifiers; lockfile integrity check passes | VERIFIED | `grep -E '[\^~]' package.json` returns nothing in dep sections. `tests/pins.test.ts` asserts all 18 deps have no `^`/`~`; `pnpm install --frozen-lockfile` succeeds in same test. All 3 tests pass in 2.53s. |

**Score:** 4/5 truths verified automatically (1 deferred to human)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `package.json` | Project deps with exact pins, name "megawallet" | VERIFIED | name: "megawallet", 5 deps + 13 devDeps, zero ^/~ |
| `public/manifest.json` | MV3 manifest with strict CSP | VERIFIED | manifest_version: 3, CSP: `script-src 'self'; object-src 'self';` |
| `scripts/build.ts` | Multi-call esbuild pipeline | VERIFIED | 4 `esbuild.build()` calls (bg ESM, content IIFE, inpage IIFE, popup ESM) + `cpSync` static assets |
| `dist/background.js` | Background service worker bundle (ESM) | VERIFIED | No IIFE wrapper; starts with raw `console.log(...)` statement |
| `dist/content.js` | Content script IIFE bundle | VERIFIED | `"use strict";(()=>{var e=document.createElement("script")...})();` |
| `dist/inpage.js` | Inpage IIFE bundle | VERIFIED | `"use strict";(()=>{console.log("[megawallet] inpage script loaded");})();` |
| `dist/popup.js` | Popup bundle with React | VERIFIED | ESM format, contains full React 19.2.4 bundle |
| `dist/popup.css` | Tailwind-processed CSS with dark mode | VERIFIED | Contains `.dark` class selectors (1+ rules), zero `prefers-color-scheme` queries |
| `dist/manifest.json` | Copied manifest in dist | VERIFIED | Byte-for-byte copy of public/manifest.json |
| `dist/popup.html` | CSP-compliant popup shell | VERIFIED | No inline scripts; loads popup.css and popup.js as module |
| `src/features/ui/App.tsx` | Main popup layout composing all components | VERIFIED | Imports Header, BalancePlaceholder, ActionButtons, ThemeProvider; renders fixed 360x600 layout |
| `src/features/ui/components/Header.tsx` | Header with branding and theme toggle | VERIFIED | "megawallet" monospace text + Button with sun/moon SVG calling `useTheme().toggle` |
| `src/features/ui/components/BalancePlaceholder.tsx` | Placeholder balance display | VERIFIED | Shows "0.00 ETH", "$0.00", "0x0000...0000" with copy icon |
| `src/features/ui/components/ActionButtons.tsx` | Disabled Send/Receive buttons | VERIFIED | Two disabled violet Buttons using shadcn/ui Button component |
| `tests/build.test.ts` | Deterministic build verification | VERIFIED | `hashDir()` SHA-256 recursive hash, two builds compared, 60s timeout |
| `tests/pins.test.ts` | Version pin verification | VERIFIED | Iterates all deps/devDeps, asserts no `^`/`~`; also runs `--frozen-lockfile` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `scripts/build.ts` | `dist/` | `esbuild.build()` calls | WIRED | 4 `esbuild.build()` calls each with `outfile: 'dist/...'`; `cpSync` copies manifest, popup.html, icons |
| `public/manifest.json` | `background.js` | `service_worker` reference | WIRED | `"service_worker": "background.js"` in `"background"` section |
| `src/entrypoints/content.ts` | `inpage.js` | `chrome.runtime.getURL` injection | WIRED | `script.src = chrome.runtime.getURL('inpage.js')` — creates script tag and appends to DOM |
| `src/features/ui/App.tsx` | `src/features/ui/components/Header.tsx` | import and render | WIRED | `import { Header } from './components/Header'` + `<Header />` in JSX |
| `tests/build.test.ts` | `dist/` | hash comparison after two builds | WIRED | `hashDir('dist')` called after each `execSync('pnpm build:prod')` |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| BUILD-01 | 01-01 | MV3 extension with strict CSP | SATISFIED | manifest_version: 3; CSP `script-src 'self'; object-src 'self';`; no inline scripts |
| BUILD-02 | 01-01 | esbuild separate bundles for background, content, popup, inpage | SATISFIED | 4 esbuild.build() calls produce 4 distinct bundles in correct formats |
| BUILD-03 | 01-01 | Exact version pins in package.json (no ^ or ~) | SATISFIED | All 18 deps exact-pinned; pins.test.ts enforces and passes |
| BUILD-04 | 01-02 | Deterministic/reproducible build output | SATISFIED | build.test.ts SHA-256 comparison passes; no Date.now/timestamps in build defines |
| BUILD-05 | 01-01 | No eval(), Function(), or dynamic import() from remote | SATISFIED | grep of all source files returns 0 matches for eval/Function( |
| BUILD-06 | 01-02 | Lockfile integrity verified | SATISFIED | `pnpm install --frozen-lockfile` runs in pins.test.ts and passes |

All 6 BUILD requirements satisfied. No orphaned requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/entrypoints/background.ts` | 1 | `// MV3 service worker -- placeholder for Phase 1` | INFO | Comment only; implementation (chrome.runtime.onInstalled listener) is real and correct for Phase 1 scope |

No blocker or warning anti-patterns. The background.ts is a minimal but complete service worker for this phase — Phase 1 scope does not require more.

### Human Verification Required

#### 1. Chrome Extension Load + Popup Render

**Test:** Open Chrome -> chrome://extensions -> enable Developer Mode -> Load unpacked -> select `dist/` folder
**Expected:** Extension installs with megawallet icon in toolbar. Clicking icon opens popup at ~360x600 showing: header with "megawallet" text and sun/moon icon button, centered "0.00 ETH" + "$0.00" + "0x0000...0000" address, Send and Receive buttons at bottom (disabled/grayed).
**Why human:** Pixel rendering, layout dimensions, and icon display require a live Chrome session.

#### 2. Theme Toggle

**Test:** With popup open, click the sun/moon button in the header.
**Expected:** UI switches between light (white background, dark text) and dark (near-black background, light text) modes. Button icon changes between sun and moon. Refreshing popup preserves last selected theme (localStorage persistence).
**Why human:** React DOM class toggle and visual theme transition require interactive browser session.

#### 3. CSP Violation Absence

**Test:** Right-click popup -> Inspect -> Console tab. Click theme toggle a few times.
**Expected:** Zero CSP violation errors in console. Zero other runtime errors.
**Why human:** CSP errors only surface in Chrome DevTools at runtime.

#### 4. Service Worker

**Test:** chrome://extensions -> megawallet -> click "Service worker" hyperlink.
**Expected:** DevTools opens showing console with `[megawallet] background service worker started`.
**Why human:** Service worker lifecycle requires Chrome's extension runtime.

### Gaps Summary

No gaps found. All automated checks pass:
- 4 dist bundles present with correct formats (ESM/IIFE)
- MV3 manifest with strict CSP present in both public/ and dist/
- Zero eval/Function in source
- Zero ^/~ version specifiers in package.json
- `pnpm test` passes: deterministic build + lockfile integrity (3 tests, 2.53s)
- All 6 BUILD requirements satisfied by 2 plans
- All key wiring links confirmed by code inspection

The remaining items are human-only verification of visual rendering and live Chrome behavior, which automated grep cannot substitute for.

---

_Verified: 2026-03-01T12:45:00Z_
_Verifier: Claude (gsd-verifier)_
