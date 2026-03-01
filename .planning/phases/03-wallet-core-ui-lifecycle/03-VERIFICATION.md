---
phase: 03-wallet-core-ui-lifecycle
verified: 2026-03-01T16:15:00Z
status: passed
score: 5/5 must-haves verified
re_verification: false
---

# Phase 3: Wallet Core UI Lifecycle Verification Report

**Phase Goal:** User can create or import a wallet, see their address, manage accounts, and lock/unlock with auto-timeout
**Verified:** 2026-03-01T16:15:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User creates new wallet: sees seed phrase once, confirms word order, sets password, lands on main screen with address displayed | VERIFIED | CreatePasswordScreen sends `wallet:create`, stores mnemonic in OnboardingContext (not zustand), SeedPhraseScreen shows 3x4 numbered grid with no copy button, ConfirmSeedScreen generates 3 challenges from BIP-39 wordlist (4 options each), on success calls `reset('main')` |
| 2 | User imports existing wallet via seed phrase and arrives at main screen with correct derived address | VERIFIED | ImportSeedScreen validates 12/24 words, stores in OnboardingContext, ImportPasswordScreen sends `wallet:import` with mnemonic, on `wallet:imported` calls `reset('main')` with accounts fetched |
| 3 | User locks wallet (manual or auto-timeout); chrome.storage.session cleared; unlock requires password | VERIFIED | Sidebar Lock button sends `wallet:lock` -> `clearSession()` + `clearAutoLockAlarm()`; chrome.alarms fires `auto-lock` -> `clearSession()`; LockScreen sends `wallet:unlock`, shake on error, countdown on lockout |
| 4 | User can derive additional accounts and switch between them; each shows correct address with copy-to-clipboard and QR code | VERIFIED | Sidebar sends `wallet:deriveAccount`, stores index in `derivedIndices`; ReceiveScreen uses `QRCodeSVG` from qrcode.react, full address + copy-to-clipboard with "Copied!" feedback; Header shows truncated address with copy |
| 5 | Service worker termination and restart preserves locked/unlocked state (unlocked if session key exists, locked if not) | VERIFIED | `ready` promise IIFE restores lockout + re-registers alarm on SW startup; `initialize()` queries `wallet:getAccounts` — success -> main, error -> lock; `chrome.storage.session` holds session key (cleared on tab/browser close but not SW termination) |

**Score:** 5/5 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/features/wallet/store.ts` | Zustand store with navigation, wallet state, background sync | VERIFIED | push/pop/replace/reset nav, initialize(), accounts, autoLockMinutes, sidebarOpen, accountNames all present |
| `src/features/ui/App.tsx` | Root component rendering current screen from store | VERIFIED | screen map Record<Screen, ComponentType>, useEffect calls initialize(), heartbeat listeners wired |
| `src/entrypoints/popup.tsx` | Popup entry without MemoryRouter | VERIFIED | Renders `<App />` directly in `<StrictMode>`, no MemoryRouter import |
| `src/features/ui/screens/WelcomeScreen.tsx` | Welcome splash with Create/Import buttons | VERIFIED | "Create New Wallet" -> push('create-password'), "Import Existing Wallet" -> push('import-seed') |
| `src/features/ui/screens/CreatePasswordScreen.tsx` | Password creation with strength meter | VERIFIED | getPasswordStrength imported and used, 3-segment meter, min 8 chars, sends wallet:create |
| `src/features/ui/screens/SeedPhraseScreen.tsx` | 3x4 seed phrase grid display (no copy button) | VERIFIED | grid-cols-3 layout, numbered words from OnboardingContext, no clipboard button |
| `src/features/ui/screens/ConfirmSeedScreen.tsx` | 3 random word position challenges with 4-choice each | VERIFIED | generateChallenges() picks 3 positions, 4 options each (1 correct + 3 from BIP-39 wordlist) |
| `src/features/ui/screens/ImportSeedScreen.tsx` | Seed phrase text entry for import flow | VERIFIED | Textarea with word count validation (12 or 24), stores in OnboardingContext |
| `src/features/ui/screens/ImportPasswordScreen.tsx` | Password creation for import flow | VERIFIED | Same strength meter pattern, sends wallet:import with mnemonic from context |
| `src/features/ui/screens/LockScreen.tsx` | Lock screen with password field, shake animation, lockout countdown | VERIFIED | animate-shake class on error, setInterval countdown, getLockoutStatus queried on mount and after error |
| `src/lib/password-strength.ts` | 3-level password strength calculator | VERIFIED | weak/medium/strong based on length + char classes, no external dependency |
| `src/features/ui/screens/MainScreen.tsx` | Phantom-style main wallet screen | VERIFIED | Header + BalancePlaceholder + ActionButtons + "No tokens yet" placeholder + Sidebar |
| `src/features/ui/screens/ReceiveScreen.tsx` | QR code + address display + copy | VERIFIED | QRCodeSVG(200px), full address, copy-to-clipboard with "Copied!" feedback |
| `src/features/ui/components/Sidebar.tsx` | Slide-from-left account switcher drawer | VERIFIED | sidebar-overlay/panel CSS, account list with jazzicon + rename, Add Account, Lock Wallet, Settings |
| `src/features/ui/components/Header.tsx` | Adaptive header (avatar/back-nav/branding modes) | VERIFIED | 3 modes: main (jazzicon + network pill), sub-screen (back arrow + title), onboarding (branding) |
| `src/lib/jazzicon.tsx` | Deterministic SVG avatar from ETH address | VERIFIED | PRNG from address, hue shift, 4 rects, circle clipPath, unique clip IDs |
| `src/features/ui/screens/SettingsScreen.tsx` | Settings page with grouped sections | VERIFIED | Security (auto-lock dropdown + seed export), Network (toggle), About (link to AboutScreen) |
| `src/features/ui/screens/AboutScreen.tsx` | About page with version, links, contact | VERIFIED | chrome.runtime.getManifest().version, Source Code, Report an Issue, Security Contact |
| `src/features/ui/components/SeedExportModal.tsx` | Password-gated seed phrase reveal modal | VERIFIED | 3-step state machine: password -> warning -> reveal; mnemonic in component-local state only |
| `src/features/wallet/types.ts` | New message types for export and auto-lock | VERIFIED | wallet:exportSeedPhrase, wallet:setAutoLockTimeout, wallet:getAutoLockTimeout, wallet:getLockoutStatus, wallet:heartbeat all present |
| `src/entrypoints/background.ts` | Auto-lock alarm handling + seed export handler | VERIFIED | chrome.alarms.onAlarm top-level listener, ready-promise gate, all handlers implemented |
| `public/manifest.json` | Added alarms permission | VERIFIED | "permissions": ["storage", "alarms"] |
| `src/features/ui/OnboardingContext.tsx` | React context for transient mnemonic/address | VERIFIED | OnboardingProvider wraps App, mnemonic never in zustand |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `src/features/ui/App.tsx` | `src/features/wallet/store.ts` | useWalletStore selector for currentScreen | WIRED | `useWalletStore((s) => s.currentScreen)` + `initialize` called in useEffect |
| `src/features/wallet/store.ts` | `src/features/wallet/messages.ts` | sendWalletMessage for background sync | WIRED | sendWalletMessage imported and called in initialize(), setNetwork() |
| `src/features/ui/screens/CreatePasswordScreen.tsx` | `src/lib/password-strength.ts` | password strength calculation | WIRED | `getPasswordStrength` imported and called on every keystroke |
| `src/features/ui/components/Sidebar.tsx` | `src/features/wallet/store.ts` | useWalletStore for accounts, activeAccountIndex, setActiveAccount | WIRED | All three selectors used; Add Account sends wallet:deriveAccount |
| `src/features/ui/screens/ReceiveScreen.tsx` | `qrcode.react` | QRCodeSVG component for QR code rendering | WIRED | `import { QRCodeSVG } from 'qrcode.react'`; rendered with address value |
| `src/features/ui/components/Header.tsx` | `src/lib/jazzicon.tsx` | Jazzicon component for account avatar | WIRED | `import { Jazzicon }` used in main screen mode with activeAccount.address |
| `src/entrypoints/background.ts` | `chrome.alarms` | Auto-lock alarm create/clear/onAlarm | WIRED | `chrome.alarms.onAlarm.addListener` at top-level; create/clear in resetAutoLockAlarm/clearAutoLockAlarm |
| `src/features/ui/components/SeedExportModal.tsx` | `src/features/wallet/messages.ts` | sendWalletMessage for wallet:exportSeedPhrase | WIRED | `sendWalletMessage({ type: 'wallet:exportSeedPhrase', password })` in handleSubmitPassword |
| `src/features/ui/screens/SettingsScreen.tsx` | `src/features/wallet/store.ts` | autoLockMinutes and network settings | WIRED | useWalletStore for network/setNetwork; wallet:getAutoLockTimeout queried on mount |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SET-01 | 03-01 | Lock/unlock wallet | SATISFIED | LockScreen sends wallet:unlock, Sidebar sends wallet:lock; both navigate via store.reset() |
| SET-05 | 03-01 | Service worker resumes unlocked state from chrome.storage.session on wake-up | SATISFIED | store.initialize() queries wallet:getAccounts; ready-promise restores lockout + re-registers alarm on SW restart |
| ACCT-02 | 03-02 | User can derive additional accounts | SATISFIED | Sidebar sends wallet:deriveAccount; derivedIndices persisted in chrome.storage.local; restored on unlock |
| ACCT-03 | 03-02 | User can view account address with copy-to-clipboard and QR code | SATISFIED | ReceiveScreen: QRCodeSVG + full address + copy button with "Copied!" feedback; Header: truncated address with copy |
| SEC-08 | 03-03 | Auto-lock clears decrypted keys after configurable timeout | SATISFIED | chrome.alarms `auto-lock` alarm; resetAutoLockAlarm on unlock/create/import; clearAutoLockAlarm on lock; heartbeat resets on user interaction; alarm re-registered on SW restart |
| SEC-09 | 03-03 | User can export seed phrase behind password re-entry and explicit warning | SATISFIED | SeedExportModal: password -> warning -> 3x4 grid reveal; wallet:exportSeedPhrase verifies password + requires unlocked session; mnemonic in component-local state only |
| SET-02 | 03-03 | Auto-lock timeout configuration (5/15/30/60 minutes) | SATISFIED | SettingsScreen auto-lock dropdown; wallet:setAutoLockTimeout validates [5,15,30,60]; persisted in chrome.storage.local |
| SET-03 | 03-03 | Network switcher (megaETH mainnet, megaETH testnet) | SATISFIED | Header NetworkPill toggles mainnet/testnet; setNetwork persists to chrome.storage.local; Settings screen also has toggle |
| SET-04 | 03-03 | About page with version, open source link, security contact | SATISFIED | AboutScreen: chrome.runtime.getManifest().version, GitHub link, Issues link, security mailto |

---

### Anti-Patterns Found

No blocker anti-patterns detected. Spot-checked all phase-created files:

- No `return null` / placeholder stubs in screen components
- No TODO/FIXME/PLACEHOLDER comments
- No empty handlers (`() => {}`)
- Mnemonic correctly isolated to OnboardingContext (not zustand, not module-level)
- `wallet:heartbeat` message sent only when session exists (no-op when locked)
- Seed phrase never appears in zustand store (verified by grep: no mnemonic field in store.ts)

---

### Human Verification Required

#### 1. Create flow end-to-end UX

**Test:** Install extension, click "Create New Wallet", set password (8+ chars), verify seed phrase screen shows 12 words in 3x4 grid with no copy button, click "I've Written It Down", complete 3 word challenges, arrive at main screen with address in header
**Expected:** Address shown as truncated (0x1234...abcd) in header; clicking opens Receive screen with QR
**Why human:** Visual layout, word grid rendering, and click-through flow cannot be verified programmatically

#### 2. Auto-lock timer fires and clears session

**Test:** Unlock wallet, set auto-lock to 5 minutes in settings, wait (or inspect chrome.alarms), verify wallet locks after timeout
**Expected:** Popup reopens to lock screen; session key absent from chrome.storage.session
**Why human:** Real-time alarm firing requires actual Chrome extension runtime

#### 3. Heartbeat resets inactivity timer

**Test:** With wallet unlocked, click/type in popup every few minutes; verify wallet does NOT lock despite timeout setting
**Expected:** Auto-lock alarm extends on each heartbeat (60s throttle)
**Why human:** Requires real Chrome extension runtime to observe alarm reset behavior

#### 4. Service worker restart preserves state

**Test:** Unlock wallet, wait for SW to terminate (chrome://extensions -> background page -> inspect service worker), reopen popup
**Expected:** Wallet reopens to main screen (if session still in storage.session); or lock screen if session cleared
**Why human:** Requires Chrome runtime to test actual SW termination/restart cycle

#### 5. Shake animation on wrong password

**Test:** Navigate to lock screen, enter wrong password, click Unlock
**Expected:** Input field shakes with 300ms horizontal animation; red error text appears
**Why human:** CSS animation cannot be verified by static analysis

---

### Build/Test Results

| Check | Result |
|-------|--------|
| `pnpm typecheck` | PASS (no errors) |
| `pnpm build` | PASS (dist/popup.js 1.3mb) |
| `pnpm lint` | PASS (45 files, no issues) |
| `pnpm test` | PASS (104 tests, 8 test files) |

Integration tests cover: wallet:exportSeedPhrase (correct password, locked, wrong password), wallet:getLockoutStatus, wallet:heartbeat (unlocked + locked), wallet:setAutoLockTimeout (valid + invalid), wallet:getAutoLockTimeout (default + after change).

---

## Summary

Phase 3 goal is fully achieved. All 5 observable truths are verified. All 9 requirement IDs (SEC-08, SEC-09, ACCT-02, ACCT-03, SET-01, SET-02, SET-03, SET-04, SET-05) are satisfied by concrete, substantive, wired implementations. No stubs, no placeholders, no orphaned artifacts.

Key security properties confirmed:
- Mnemonic never touches zustand store (OnboardingContext only, cleared on flow completion)
- Seed export requires password re-entry even when already unlocked
- Auto-lock uses chrome.alarms (survives SW restart), resets on user heartbeat (true inactivity)
- `chrome.storage.session` cleared on lock, preserving locked state across SW restarts
- ready-promise gates all message handling until lockout state restored (no race condition)

---

_Verified: 2026-03-01T16:15:00Z_
_Verifier: Claude (gsd-verifier)_
