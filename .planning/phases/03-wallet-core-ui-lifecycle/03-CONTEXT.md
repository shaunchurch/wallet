# Phase 3: Wallet Core UI & Lifecycle - Context

**Gathered:** 2026-03-01
**Status:** Ready for planning

<domain>
## Phase Boundary

User can create or import a wallet, see their address, manage multiple accounts, lock/unlock with auto-timeout, and configure settings. All backend message handlers already exist in background service worker (create, import, unlock, lock, getAccounts, deriveAccount). This phase is entirely popup UI screens and lifecycle wiring.

</domain>

<decisions>
## Implementation Decisions

### Onboarding flow
- Welcome screen: splash with logo/branding + two prominent buttons ("Create New Wallet" / "Import Existing Wallet")
- Create flow order: Password > Seed Phrase > Confirm (password first = most secure, vault encrypted before seed shown)
- Seed phrase displayed as numbered 3x4 grid (all 12 words visible at once)
- No copy-to-clipboard button on seed phrase screen (security: clipboard is attack vector)
- Confirmation: pick 3 random word positions, user selects each from 4-choice multiple choice
- Forced confirmation — no skip option. Wallet unusable until seed confirmed (SEC-03)
- Password creation: visual strength meter (weak/medium/strong), minimum 8 chars enforced
- Import flow: multi-step (step 1: seed phrase entry, step 2: set password) — mirrors create flow structure

### Main wallet screen
- Phantom-style layout — modern, clean, NOT MetaMask. Reference Phantom wallet for UX patterns
- Account avatar: jazzicon/blockies + truncated address (0x1234...abcd) at top, tap to copy
- Account names: editable (default "Account 1", "Account 2"), user can rename, persisted in storage
- Account switcher: sidebar sliding in from left (Phantom/Slack/Discord style)
- Sidebar contains: account list at top, Lock Wallet + Settings links at bottom
- Active account in sidebar: checkmark icon + subtle background highlight
- Action buttons: horizontal row of circular icon buttons (Send, Receive, Buy)
- Balance area: large ETH balance + USD fiat conversion, scrollable token area below with "No tokens yet" placeholder (ready for Phase 8)
- QR code: accessed via dedicated Receive screen (tap Receive action button)

### Navigation
- In-memory state router — simple React state, push/pop navigation stack, no library
- Back navigation: left arrow replaces logo in header on sub-screens, screen title in center
- Screen transitions: subtle slide animations (left/right on navigate, sidebar slides in)
- Network switcher: pill badge in header next to logo, tap to toggle mainnet/testnet

### Settings
- Settings page: grouped list (iOS Settings style) — Security, Network, About sections
- Auto-lock timeout: select dropdown with 5/15/30/60 min options
- Seed phrase export (SEC-09): password re-entry modal overlay, warning text, then reveals seed grid
- About page: renders inside popup (version, open source link, security contact)
- Theme toggle: stays in header (quick access), not duplicated in settings

### Lock screen
- Minimal centered layout: logo at top, single password field, unlock button
- Wrong password: shake animation on input + red error text below
- Lockout feedback: inline countdown replaces password field, field re-appears when lockout expires
- Auto-lock trigger: silent — just shows lock screen, no "locked due to inactivity" message

### Claude's Discretion
- Exact jazzicon/blockies implementation choice
- Loading states and skeleton screens
- Exact animation timing and easing curves
- Toast/notification system implementation
- Price API source for ETH/USD conversion
- Exact password strength algorithm
- Error state designs beyond lock screen

</decisions>

<specifics>
## Specific Ideas

- "Phantom style, not MetaMask — MetaMask is embarrassingly bad now. Modern wallets like Phantom have much better UX"
- Sidebar account switcher like Phantom/Slack/Discord — slide from left, multi-account feel
- The wallet should feel polished with subtle animations, not instant screen swaps

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Button` component (`@/components/ui/button.tsx`): shadcn-style, ghost/icon-sm variants available
- `ThemeProvider` + `useTheme()`: dark/light toggle already working
- `Header` component: has branding + theme toggle, will need modification for network pill + account avatar
- `sendWalletMessage()` (`features/wallet/messages.ts`): typed message passing to background, ready to use
- `ActionButtons` / `BalancePlaceholder`: placeholder components to be replaced with real implementations

### Established Patterns
- Feature-first directory structure: `features/wallet/`, `features/ui/`
- Tailwind CSS v4 with CSS theme variables (oklch accent, zinc palette)
- Typed message architecture: popup sends `WalletMessage`, receives `WalletResponse`
- Storage split: `chrome.storage.local` for vault, `chrome.storage.session` for unlocked session
- Dark mode via class-based `.dark` variant

### Integration Points
- `src/entrypoints/popup.tsx` renders `App` — needs routing layer added here
- Background service worker already handles all Phase 3 message types: create, confirmSeedPhrase, import, unlock, lock, getAccounts, deriveAccount
- `WalletSession` in background tracks seed + accounts — popup needs to mirror this state
- Lockout state persists in `chrome.storage.session` — popup needs to read lockout status for UI

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-wallet-core-ui-lifecycle*
*Context gathered: 2026-03-01*
