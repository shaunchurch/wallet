# Phase 3: Wallet Core UI & Lifecycle - Research

**Researched:** 2026-03-01
**Domain:** Chrome extension popup UI, wallet lifecycle, React state management
**Confidence:** HIGH

## Summary

Phase 3 is entirely popup UI screens + lifecycle wiring. All backend message handlers exist (create, confirmSeedPhrase, import, unlock, lock, getAccounts, deriveAccount). The work is: onboarding flow (welcome, create, import), main wallet screen (Phantom-style), lock screen, settings, sidebar account switcher, and auto-lock via chrome.alarms API.

Key architectural decisions are already locked: zustand for state (already installed v5.0.11), in-memory navigation stack (React state, no router library despite react-router being installed), Tailwind v4 for styling, typed message passing via `sendWalletMessage()`. The main technical challenges are: (1) chrome.alarms for auto-lock surviving service worker termination, (2) navigation state machine for multi-step onboarding, (3) syncing popup state with background session on open.

**Primary recommendation:** Build screens as pure components driven by a zustand store that initializes by querying background state on popup mount. Use chrome.alarms for auto-lock (add "alarms" permission). Hand-roll jazzicon SVG and password strength meter to avoid dependencies.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Welcome screen: splash with logo/branding + two prominent buttons ("Create New Wallet" / "Import Existing Wallet")
- Create flow order: Password > Seed Phrase > Confirm (password first = most secure, vault encrypted before seed shown)
- Seed phrase displayed as numbered 3x4 grid (all 12 words visible at once)
- No copy-to-clipboard button on seed phrase screen (security: clipboard is attack vector)
- Confirmation: pick 3 random word positions, user selects each from 4-choice multiple choice
- Forced confirmation -- no skip option. Wallet unusable until seed confirmed (SEC-03)
- Password creation: visual strength meter (weak/medium/strong), minimum 8 chars enforced
- Import flow: multi-step (step 1: seed phrase entry, step 2: set password) -- mirrors create flow structure
- Phantom-style layout -- modern, clean, NOT MetaMask. Reference Phantom wallet for UX patterns
- Account avatar: jazzicon/blockies + truncated address (0x1234...abcd) at top, tap to copy
- Account names: editable (default "Account 1", "Account 2"), user can rename, persisted in storage
- Account switcher: sidebar sliding in from left (Phantom/Slack/Discord style)
- Sidebar contains: account list at top, Lock Wallet + Settings links at bottom
- Active account in sidebar: checkmark icon + subtle background highlight
- Action buttons: horizontal row of circular icon buttons (Send, Receive, Buy)
- Balance area: large ETH balance + USD fiat conversion, scrollable token area below with "No tokens yet" placeholder
- QR code: accessed via dedicated Receive screen (tap Receive action button)
- In-memory state router -- simple React state, push/pop navigation stack, no library
- Back navigation: left arrow replaces logo in header on sub-screens, screen title in center
- Screen transitions: subtle slide animations (left/right on navigate, sidebar slides in)
- Network switcher: pill badge in header next to logo, tap to toggle mainnet/testnet
- Settings page: grouped list (iOS Settings style) -- Security, Network, About sections
- Auto-lock timeout: select dropdown with 5/15/30/60 min options
- Seed phrase export (SEC-09): password re-entry modal overlay, warning text, then reveals seed grid
- About page: renders inside popup (version, open source link, security contact)
- Theme toggle: stays in header (quick access), not duplicated in settings
- Lock screen: minimal centered layout: logo at top, single password field, unlock button
- Wrong password: shake animation on input + red error text below
- Lockout feedback: inline countdown replaces password field, field re-appears when lockout expires
- Auto-lock trigger: silent -- just shows lock screen, no "locked due to inactivity" message

### Claude's Discretion
- Exact jazzicon/blockies implementation choice
- Loading states and skeleton screens
- Exact animation timing and easing curves
- Toast/notification system implementation
- Price API source for ETH/USD conversion
- Exact password strength algorithm
- Error state designs beyond lock screen

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SEC-08 | Auto-lock clears decrypted keys after configurable timeout (5/15/30/60 min) | chrome.alarms API for MV3-safe timers; `wallet:lock` message handler already clears session; alarm listener in background.ts top-level |
| SEC-09 | User can export seed phrase behind password re-entry and explicit warning | `wallet:unlock` verifies password (reusable); add `wallet:exportSeedPhrase` message type; popup shows modal overlay with warning + seed grid |
| ACCT-02 | User can derive additional accounts (incrementing last index) | `wallet:deriveAccount` handler exists; popup sends index, background derives + caches; zustand store tracks account list |
| ACCT-03 | User can view account address with copy-to-clipboard and QR code | `navigator.clipboard.writeText()` for copy; `qrcode.react` QRCodeSVG for QR; Receive screen shows both |
| SET-01 | Lock/unlock wallet | `wallet:lock` / `wallet:unlock` handlers exist; lock screen UI + sidebar lock button |
| SET-02 | Auto-lock timeout configuration (5/15/30/60 minutes) | chrome.storage.local for persisted setting; chrome.alarms.create with delayInMinutes; reset alarm on popup interaction |
| SET-03 | Network switcher (megaETH mainnet, megaETH testnet) | Zustand store + chrome.storage.local for persistence; header pill badge toggles; no RPC calls in this phase |
| SET-04 | About page with version, open source link, security contact | Static screen rendered inline; version from manifest via chrome.runtime.getManifest() |
| SET-05 | Service worker resumes unlocked state from chrome.storage.session on wake-up | Session already persists via `cacheSession()`; popup queries `wallet:getAccounts` on mount to detect locked/unlocked |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zustand | 5.0.11 | Popup state management | Already installed; lightweight (~1kB), no boilerplate, TS-native, selector-based re-renders |
| react | 19.2.4 | UI rendering | Already installed |
| qrcode.react | 4.2.0 | QR code SVG generation | Standard React QR lib; SVG output (no canvas needed); 1191 dependents on npm |
| tailwindcss | 4.2.1 | Styling | Already installed; CSS-first config with oklch theming established |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| class-variance-authority | 0.7.1 | Component variants | Already installed; used in Button component |
| clsx + tailwind-merge | 2.1.1 / 3.5.0 | Class merging | Already installed; `cn()` utility in lib/utils |

### Not Adding (Hand-Roll Instead)
| Problem | Why Not a Library | Hand-Roll Approach |
|---------|-------------------|--------------------|
| Jazzicon/blockies avatar | `@ukstv/jazzicon-react` archived Aug 2025; `react-jazzicon` depends on deprecated `mersenne-twister`; `@raugfer/jazzicon` has 3 stars | ~80-line React component: seed from address, Mersenne Twister PRNG, HSL palette shift, 4 rotated rectangles in SVG circle mask. Well-documented algorithm from gist reference |
| Password strength meter | zxcvbn is ~800kB minified, far too heavy for popup bundle | Simple 3-level (weak/medium/strong) based on: length >= 8/12/16, char class diversity (lower/upper/digit/special), no sequential/repeated chars. ~30 lines |
| Navigation/routing | User decided "in-memory state router, no library" | Zustand nav store with screen stack, push/pop/replace. ~40 lines. NOTE: react-router is installed but won't be used for popup navigation per user decision; remove MemoryRouter wrapper from popup.tsx |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled jazzicon | `@raugfer/jazzicon` (npm) | Adds dependency for ~80 lines of deterministic SVG; low star count (3) raises maintenance risk |
| Hand-rolled nav | react-router MemoryRouter | Already installed, but user explicitly wants simple state-based navigation; react-router adds complexity for a popup with ~10 screens |
| Hand-rolled password strength | zxcvbn-ts | Better accuracy but 200kB+ even with tree-shaking; overkill for 3-level meter |

**Installation:**
```bash
pnpm add qrcode.react@4.2.0
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/ui/          # Shared UI primitives (button, input, etc.)
├── features/
│   ├── ui/
│   │   ├── App.tsx              # Root: init + screen renderer
│   │   ├── ThemeProvider.tsx     # Existing
│   │   ├── components/
│   │   │   ├── Header.tsx       # Modified: avatar, network pill, back nav
│   │   │   └── Sidebar.tsx      # NEW: account switcher drawer
│   │   └── screens/
│   │       ├── WelcomeScreen.tsx
│   │       ├── CreatePasswordScreen.tsx
│   │       ├── SeedPhraseScreen.tsx
│   │       ├── ConfirmSeedScreen.tsx
│   │       ├── ImportSeedScreen.tsx
│   │       ├── ImportPasswordScreen.tsx
│   │       ├── MainScreen.tsx
│   │       ├── ReceiveScreen.tsx
│   │       ├── LockScreen.tsx
│   │       ├── SettingsScreen.tsx
│   │       └── AboutScreen.tsx
│   └── wallet/
│       ├── store.ts             # NEW: zustand store (nav, accounts, settings)
│       ├── messages.ts          # Existing message wrapper
│       └── types.ts             # Existing types (may need new message types)
├── entrypoints/
│   ├── background.ts           # Modified: add alarm listener, export handler
│   └── popup.tsx               # Modified: remove MemoryRouter, add store init
├── lib/
│   ├── utils.ts                # Existing cn()
│   └── jazzicon.tsx            # NEW: hand-rolled jazzicon component
└── styles/globals.css          # Existing
```

### Pattern 1: Zustand Store with Background Sync
**What:** Single zustand store drives all popup UI state. On popup mount, query background for current state.
**When to use:** Every popup open.
**Example:**
```typescript
// Source: Zustand docs + Chrome extension pattern
import { create } from 'zustand';
import { sendWalletMessage } from './messages';
import type { DerivedAccount } from './types';

type Screen =
  | 'welcome' | 'create-password' | 'seed-phrase' | 'confirm-seed'
  | 'import-seed' | 'import-password'
  | 'main' | 'receive' | 'lock' | 'settings' | 'about';

interface WalletStore {
  // Navigation
  screenStack: Screen[];
  currentScreen: Screen;
  push: (screen: Screen) => void;
  pop: () => void;
  replace: (screen: Screen) => void;

  // Wallet state
  isLocked: boolean;
  accounts: DerivedAccount[];
  activeAccountIndex: number;
  network: 'mainnet' | 'testnet';

  // Actions
  initialize: () => Promise<void>;
  setAccounts: (accounts: DerivedAccount[]) => void;
  setActiveAccount: (index: number) => void;
  setNetwork: (network: 'mainnet' | 'testnet') => void;
}

export const useWalletStore = create<WalletStore>()((set, get) => ({
  screenStack: ['welcome'],
  currentScreen: 'welcome',
  push: (screen) => set((s) => ({
    screenStack: [...s.screenStack, screen],
    currentScreen: screen,
  })),
  pop: () => set((s) => {
    const stack = s.screenStack.slice(0, -1);
    return {
      screenStack: stack,
      currentScreen: stack[stack.length - 1] ?? 'welcome',
    };
  }),
  replace: (screen) => set((s) => ({
    screenStack: [...s.screenStack.slice(0, -1), screen],
    currentScreen: screen,
  })),

  isLocked: true,
  accounts: [],
  activeAccountIndex: 0,
  network: 'mainnet',

  initialize: async () => {
    // Check if vault exists
    const result = await chrome.storage.local.get('vault');
    if (!result.vault) {
      set({ currentScreen: 'welcome', screenStack: ['welcome'], isLocked: false });
      return;
    }
    // Check if unlocked (session exists)
    const resp = await sendWalletMessage({ type: 'wallet:getAccounts' });
    if (resp.type === 'wallet:accounts') {
      set({
        isLocked: false,
        accounts: resp.accounts,
        currentScreen: 'main',
        screenStack: ['main'],
      });
    } else {
      set({ isLocked: true, currentScreen: 'lock', screenStack: ['lock'] });
    }
  },

  setAccounts: (accounts) => set({ accounts }),
  setActiveAccount: (index) => set({ activeAccountIndex: index }),
  setNetwork: (network) => set({ network }),
}));
```

### Pattern 2: Screen Renderer with Transition Animation
**What:** App.tsx renders current screen from store, with CSS transition for slide effect.
**When to use:** Root component pattern.
**Example:**
```typescript
// Screen renderer driven by zustand store
function App() {
  const currentScreen = useWalletStore((s) => s.currentScreen);
  const initialize = useWalletStore((s) => s.initialize);

  useEffect(() => { initialize(); }, [initialize]);

  const screens: Record<Screen, () => JSX.Element> = {
    'welcome': WelcomeScreen,
    'create-password': CreatePasswordScreen,
    'seed-phrase': SeedPhraseScreen,
    'confirm-seed': ConfirmSeedScreen,
    'import-seed': ImportSeedScreen,
    'import-password': ImportPasswordScreen,
    'main': MainScreen,
    'receive': ReceiveScreen,
    'lock': LockScreen,
    'settings': SettingsScreen,
    'about': AboutScreen,
  };

  const ScreenComponent = screens[currentScreen];
  return (
    <ThemeProvider>
      <div className="flex h-[600px] w-[360px] flex-col overflow-hidden bg-white dark:bg-zinc-950">
        <ScreenComponent />
      </div>
    </ThemeProvider>
  );
}
```

### Pattern 3: Auto-Lock via chrome.alarms
**What:** Background sets alarm on unlock, clears on lock. Alarm fires -> clear session.
**When to use:** SEC-08 auto-lock requirement.
**Example:**
```typescript
// In background.ts -- top-level alarm listener (survives SW restart)
const AUTO_LOCK_ALARM = 'auto-lock';

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === AUTO_LOCK_ALARM) {
    await clearSession();
    await removePendingCreation();
  }
});

// Called after successful unlock
async function resetAutoLockAlarm(): Promise<void> {
  const { autoLockMinutes } = await chrome.storage.local.get('autoLockMinutes');
  const minutes = (autoLockMinutes as number) || 15; // default 15 min
  await chrome.alarms.clear(AUTO_LOCK_ALARM);
  await chrome.alarms.create(AUTO_LOCK_ALARM, { delayInMinutes: minutes });
}

// Called on lock
async function clearAutoLockAlarm(): Promise<void> {
  await chrome.alarms.clear(AUTO_LOCK_ALARM);
}
```

### Pattern 4: New Message Types for Phase 3
**What:** Extend WalletMessage/WalletResponse for seed export and auto-lock config.
**When to use:** SEC-09 seed export, SET-02 auto-lock config.
**Example:**
```typescript
// Additional message types to add to types.ts
| { type: 'wallet:exportSeedPhrase'; password: string }
| { type: 'wallet:setAutoLockTimeout'; minutes: number }
| { type: 'wallet:getAutoLockTimeout' }

// Additional response types
| { type: 'wallet:seedPhrase'; mnemonic: string }
| { type: 'wallet:autoLockTimeout'; minutes: number }
| { type: 'wallet:settingsSaved' }
```

### Anti-Patterns to Avoid
- **Storing navigation state in chrome.storage:** Popup is ephemeral; navigation resets on close. Always re-derive from wallet state (locked? -> lock screen; no vault? -> welcome; unlocked? -> main).
- **Using setTimeout for auto-lock:** Service worker terminates after 30s idle; timers are cancelled. MUST use chrome.alarms.
- **Querying background on every render:** Query once on mount via `initialize()`, then update store locally from message responses. Background is source of truth only for crypto operations.
- **Exposing seed phrase in store:** Seed phrase flows through message response -> screen component -> display. Never persisted in zustand store. Component-local state only, cleared on unmount.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| QR code generation | Custom QR encoder | `qrcode.react` QRCodeSVG | QR encoding has complex error correction math; 4.2.0 is stable, SVG output, ~10kB |
| Clipboard API | Custom clipboard handling | `navigator.clipboard.writeText()` | Standard Web API; works in extension popup; handles permissions |
| Vault encryption | Custom crypto | Existing `encryptVault`/`decryptVault` | Already built in Phase 2; PBKDF2 + AES-256-GCM |
| Session management | Custom session tracking | Existing `cacheSession`/`clearSession` | Already built in Phase 2; chrome.storage.session |

**Key insight:** Phase 3 should build ZERO new crypto. All security operations delegate to existing background handlers via messages.

## Common Pitfalls

### Pitfall 1: Popup State Loss on Close/Reopen
**What goes wrong:** Popup closes -> user reopens -> sees wrong screen (welcome instead of main).
**Why it happens:** React state resets on popup mount. No persistence of "which screen."
**How to avoid:** `initialize()` on mount queries background state and derives correct initial screen. Never persist screen name; derive it: no vault -> welcome, locked -> lock, unlocked -> main.
**Warning signs:** User sees onboarding after already creating wallet.

### Pitfall 2: Service Worker Alarm Registration
**What goes wrong:** Auto-lock stops working after browser restart or extension update.
**Why it happens:** Alarms may be cleared on browser restart (Chrome docs: "not guaranteed to persist").
**How to avoid:** Re-register alarm listener at top-level of background.ts (always runs on SW start). Check if alarm exists in `chrome.runtime.onStartup` and re-create if missing.
**Warning signs:** Wallet stays unlocked indefinitely after restart.

### Pitfall 3: Race Between Popup Init and Background Wake
**What goes wrong:** Popup sends `wallet:getAccounts` before background service worker finishes restoring lockout state.
**Why it happens:** `restoreLockout()` is async but called without await at module top-level.
**How to avoid:** Ensure `restoreLockout()` completes before message handler processes requests. Use a ready promise pattern.
**Warning signs:** First unlock attempt after browser restart shows incorrect lockout state.

### Pitfall 4: Seed Phrase Exposure in React State
**What goes wrong:** Seed phrase stored in zustand store -> accessible via React DevTools or memory dump.
**Why it happens:** Convenience of global state for passing between screens.
**How to avoid:** Keep seed phrase in component-local state (`useState`) only in SeedPhraseScreen and ConfirmSeedScreen. Clear on unmount. Never in global store.
**Warning signs:** Seed phrase visible in devtools state inspector after leaving seed screen.

### Pitfall 5: react-router Conflict
**What goes wrong:** `MemoryRouter` wrapper in popup.tsx conflicts with custom navigation store.
**Why it happens:** Phase 1 scaffolded with react-router; user decided against it in Phase 3 discussion.
**How to avoid:** Remove `MemoryRouter` from popup.tsx. Keep `react-router` in package.json (may use for future content script pages), but don't use in popup.
**Warning signs:** Double navigation state, URL-based routing attempts in popup.

### Pitfall 6: Auto-Lock Alarm Minimum Delay
**What goes wrong:** Setting alarm with 5-minute delay works, but sub-30-second alarms silently round up.
**Why it happens:** Chrome 120+ enforces 30-second minimum for alarms. 5/15/30/60 minute options are all above this, so no issue for configured values. But testing with short intervals won't work in packed extensions.
**How to avoid:** Use unpacked extension for dev testing with short intervals. All production values (5/15/30/60 min) are well above minimum.
**Warning signs:** Tests with 1-second auto-lock appear to not fire.

## Code Examples

### Jazzicon SVG Component (Hand-Rolled)
```typescript
// Source: Algorithm from gist.github.com/aalmada/623b71962125ccd6a1ba9dad549a77d3
// Simplified Mersenne Twister PRNG + HSL palette shifting

const COLORS = [
  '#01888C', '#FC7500', '#034F5D', '#F73F01',
  '#FC1960', '#C7144C', '#F3C100', '#1598F2',
  '#2465E1', '#F19E02',
];

function addressToSeed(address: string): number {
  return Number.parseInt(address.slice(2, 10), 16);
}

// Simple PRNG seeded from address
function createPrng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function Jazzicon({ address, size = 32 }: { address: string; size?: number }) {
  const seed = addressToSeed(address);
  const rand = createPrng(seed);

  // Shift hue for all colors
  const hueShift = rand() * 360;
  const palette = COLORS.map((c) => shiftHue(c, hueShift));

  const bgIdx = Math.floor(rand() * palette.length);
  const bgColor = palette[bgIdx];
  const remaining = palette.filter((_, i) => i !== bgIdx);

  // Generate 4 shapes
  const shapes = Array.from({ length: 4 }, () => {
    const color = remaining[Math.floor(rand() * remaining.length)];
    const x = (rand() * 2 - 1) * size;
    const y = (rand() * 2 - 1) * size;
    const rot = rand() * 360;
    return { color, x, y, rot };
  });

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
      <clipPath id={`clip-${seed}`}>
        <circle cx={size / 2} cy={size / 2} r={size / 2} />
      </clipPath>
      <g clipPath={`url(#clip-${seed})`}>
        <rect width={size} height={size} fill={bgColor} />
        {shapes.map((s, i) => (
          <rect
            key={i}
            x={0} y={0}
            width={size}
            height={size}
            fill={s.color}
            transform={`translate(${s.x} ${s.y}) rotate(${s.rot} ${size / 2} ${size / 2})`}
          />
        ))}
      </g>
    </svg>
  );
}
```

### Password Strength Meter
```typescript
// Simple 3-level password strength (no external dependency)
type Strength = 'weak' | 'medium' | 'strong';

export function getPasswordStrength(password: string): Strength {
  if (password.length < 8) return 'weak';

  let score = 0;
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  if (score <= 2) return 'weak';
  if (score <= 4) return 'medium';
  return 'strong';
}
```

### Seed Phrase Confirmation Challenge Generator
```typescript
// Generate 3 random word positions with 4 choices each
function generateChallenges(words: string[]): Challenge[] {
  const allWords = [...new Set(words)]; // unique words from phrase
  const positions = Array.from({ length: words.length }, (_, i) => i);

  // Pick 3 random positions
  const selected: number[] = [];
  while (selected.length < 3) {
    const idx = Math.floor(Math.random() * positions.length);
    const pos = positions[idx]!;
    if (!selected.includes(pos)) selected.push(pos);
  }

  return selected.sort((a, b) => a - b).map((pos) => {
    const correct = words[pos]!;
    // Pick 3 wrong answers from BIP-39 wordlist (not in phrase)
    const wrong = pickRandomWrong(correct, allWords, 3);
    const options = shuffle([correct, ...wrong]);
    return { position: pos, correctWord: correct, options };
  });
}
```

### Copy-to-Clipboard with Feedback
```typescript
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// In component:
const [copied, setCopied] = useState(false);
const handleCopy = async () => {
  const ok = await copyToClipboard(address);
  if (ok) {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
};
```

### Sidebar Slide Animation (CSS)
```css
/* Sidebar slides from left */
.sidebar-overlay {
  position: fixed;
  inset: 0;
  background: rgb(0 0 0 / 0.5);
  opacity: 0;
  transition: opacity 200ms ease;
}
.sidebar-overlay[data-open="true"] { opacity: 1; }

.sidebar-panel {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  width: 280px;
  transform: translateX(-100%);
  transition: transform 200ms ease;
}
.sidebar-panel[data-open="true"] { transform: translateX(0); }
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `setTimeout` in background | `chrome.alarms` API | MV3 (2023+) | Service worker termination kills timers; alarms persist |
| Background pages (MV2) | Service workers (MV3) | MV3 mandatory | No persistent state in memory; must use storage APIs |
| `chrome.alarms` 1-min minimum | 30-second minimum | Chrome 120 (Dec 2023) | Can set alarms as low as 0.5 minutes |
| `setInterval` for countdown | Derive from stored timestamp | MV3 | Popup reads `lockedUntil` timestamp, renders countdown via `requestAnimationFrame` |
| zxcvbn for password strength | Simple heuristic for 3-level | Bundle size concern | 800kB library vs 30 lines for weak/medium/strong |

**Deprecated/outdated:**
- `react-jazzicon`: Depends on `mersenne-twister` package which is unmaintained
- `@ukstv/jazzicon-react`: Archived August 2025; read-only repo
- `chrome.extension.getBackgroundPage()`: Removed in MV3; use message passing

## Open Questions

1. **react-router removal scope**
   - What we know: User decided "in-memory state router, no library." react-router v7 is installed (package.json) and MemoryRouter wraps popup.
   - What's unclear: Should react-router be removed from package.json entirely, or just not used in popup?
   - Recommendation: Remove MemoryRouter from popup.tsx. Keep react-router in package.json -- may be useful for future standalone pages (onboarding tab, etc.). Unused code is tree-shaken by esbuild.

2. **Account names persistence location**
   - What we know: User wants editable account names persisted in storage. Background only tracks DerivedAccount (index, address, path).
   - What's unclear: Store names in chrome.storage.local alongside vault? Or in a separate key?
   - Recommendation: Separate key in chrome.storage.local: `accountNames: { [index: number]: string }`. Not sensitive data, doesn't need encryption. Popup reads/writes directly.

3. **ETH/USD price source**
   - What we know: Balance area shows USD fiat conversion. "Price API source for ETH/USD conversion" is Claude's discretion.
   - What's unclear: Which API? CoinGecko? Placeholder for now?
   - Recommendation: Placeholder "$0.00" for Phase 3. Real price feed comes with Phase 6 (real-time features) or Phase 8 (token ecosystem). Avoids external API dependency in this phase.

4. **Seed phrase export message type**
   - What we know: SEC-09 requires password re-entry to export. Background has `decryptVault()` which returns `VaultPlaintext` containing mnemonic.
   - What's unclear: Reuse `wallet:unlock` (already verifies password) or add dedicated `wallet:exportSeedPhrase`?
   - Recommendation: Add `wallet:exportSeedPhrase` message type. It verifies password AND returns mnemonic in one round-trip. Separate from unlock to maintain clear intent and audit trail. Requires wallet to already be unlocked (session must exist).

## Sources

### Primary (HIGH confidence)
- `/pmndrs/zustand` (Context7) - Store creation, TypeScript patterns, selectors, persist middleware
- `/zpao/qrcode.react` (Context7) - QRCodeSVG props, usage, custom styles
- `/remix-run/react-router` (Context7) - MemoryRouter API, Routes/Route components
- [Chrome Alarms API](https://developer.chrome.com/docs/extensions/reference/api/alarms) - create/clear/onAlarm, minimum 30s delay, AlarmCreateInfo, permissions
- [Chrome Service Worker Lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) - Termination behavior, 30s idle timeout, 5-min cap

### Secondary (MEDIUM confidence)
- [Jazzicon algorithm](https://gist.github.com/aalmada/623b71962125ccd6a1ba9dad549a77d3) - Pure React SVG jazzicon, Mersenne Twister PRNG, HSL palette shifting
- [qrcode.react v4.2.0](https://www.npmjs.com/package/qrcode.react) - Latest stable version, QRCodeSVG component
- [zxcvbn bundle size](https://github.com/dropbox/zxcvbn) - ~800kB minified, not tree-shakeable, too heavy for popup

### Tertiary (LOW confidence)
- [@raugfer/jazzicon](https://github.com/raugfer/jazzicon) - Pure SVG generator, 3 stars, MIT license -- low adoption but correct algorithm

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - zustand, react, tailwind already installed and working; qrcode.react is well-established
- Architecture: HIGH - Clear patterns from existing codebase; zustand store + message passing proven in Phase 2
- Pitfalls: HIGH - Chrome MV3 service worker behavior well-documented; alarm API constraints verified via official docs
- Hand-rolled components: MEDIUM - Jazzicon algorithm is documented but implementation needs testing; password strength heuristic is simple but may need tuning

**Research date:** 2026-03-01
**Valid until:** 2026-03-31 (stable domain, no fast-moving dependencies)
