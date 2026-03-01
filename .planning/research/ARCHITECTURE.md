# Architecture Research

**Domain:** Chrome Manifest V3 Crypto Wallet Extension (megaETH L2)
**Researched:** 2026-03-01
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         WEB PAGE CONTEXT                            │
│  ┌───────────────┐                                                  │
│  │  Inpage Script │ window.ethereum (EIP-1193) + EIP-6963 announce  │
│  └───────┬───────┘                                                  │
│          │ window.postMessage                                       │
├──────────┼──────────────────────────────────────────────────────────┤
│          │           CONTENT SCRIPT (isolated world)                │
│  ┌───────▼───────┐                                                  │
│  │ Message Relay  │ validate origin, schema, rate-limit             │
│  └───────┬───────┘                                                  │
│          │ chrome.runtime.sendMessage / Port                        │
├──────────┼──────────────────────────────────────────────────────────┤
│          │          BACKGROUND SERVICE WORKER                       │
│  ┌───────▼───────┐  ┌──────────────┐  ┌───────────────┐            │
│  │  RPC Router   │  │ KeyringCtrl  │  │ PermissionCtrl│            │
│  └───────┬───────┘  └──────┬───────┘  └───────┬───────┘            │
│          │                 │                   │                    │
│  ┌───────▼───────┐  ┌──────▼───────┐  ┌───────▼───────┐            │
│  │ TransactionCtrl│  │ NetworkCtrl  │  │  WalletCtrl   │            │
│  └───────┬───────┘  └──────┬───────┘  └───────────────┘            │
│          │                 │                                        │
│          │    WebSocket    │    HTTP RPC                             │
│          │  (stateChanges) │  (eth_*, realtime_*)                   │
├──────────┼─────────────────┼────────────────────────────────────────┤
│          │     STORAGE LAYER                                        │
│  ┌───────▼───────┐  ┌──────▼───────┐  ┌───────────────┐            │
│  │ chrome.storage │  │chrome.storage│  │  In-Memory    │            │
│  │    .local      │  │  .session    │  │  (SW only)    │            │
│  │ (encrypted     │  │ (session key,│  │ (decrypted    │            │
│  │  vault, prefs) │  │  lock state) │  │  keys during  │            │
│  └───────────────┘  └──────────────┘  │  signing)     │            │
│                                        └───────────────┘            │
├─────────────────────────────────────────────────────────────────────┤
│                        POPUP UI (React)                             │
│  ┌───────────────┐  ┌──────────────┐  ┌───────────────┐            │
│  │  Unlock/Auth   │  │  Send/Sign   │  │  Activity     │            │
│  └───────────────┘  └──────────────┘  └───────────────┘            │
│         communicates via chrome.runtime only                        │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Communicates With |
|-----------|----------------|-------------------|
| **Inpage Script** | Inject `window.ethereum` (EIP-1193), dispatch EIP-6963 events, proxy RPC calls to content script | Content Script (postMessage) |
| **Content Script** | Validate/relay messages between page and SW, enforce origin, schema, rate limits | Inpage (postMessage), SW (chrome.runtime) |
| **Background Service Worker** | Key management, signing, tx construction, RPC routing, WebSocket subscriptions, permission checks | Content Script, Popup, Storage, megaETH RPC |
| **Popup UI** | Unlock wallet, confirm transactions, display balances/activity, settings | SW only (chrome.runtime) |
| **chrome.storage.local** | Persist encrypted vault (seed + derived keys), user preferences, token lists, tx history | SW reads/writes |
| **chrome.storage.session** | Hold derived encryption key (session key) while unlocked, lock state; survives SW restart, clears on browser close | SW reads/writes |
| **In-Memory (SW)** | Decrypted private keys during active signing operations only; zeroed immediately after | SW internal |

## Security Boundary Model

Four isolated execution contexts with strict privilege separation:

```
TRUST LEVEL          CONTEXT              CAN ACCESS
─────────────────────────────────────────────────────────
UNTRUSTED            Inpage Script        window.ethereum only
                     (page world)         No chrome.* APIs
                                          No private keys

LOW TRUST            Content Script       chrome.runtime.sendMessage
                     (isolated world)     chrome.storage (if enabled)
                                          No DOM manipulation of extension
                                          No key material

HIGH TRUST           Service Worker       All chrome.* APIs
                     (extension context)  chrome.storage.local/session
                                          Crypto operations
                                          Network access (RPC, WS)

HIGH TRUST           Popup UI             chrome.runtime messaging
                     (extension context)  Display only, no direct crypto
```

**Key security rules:**
- Private keys exist ONLY in the SW, ONLY as `Uint8Array`, ONLY during signing
- Keys never cross context boundaries; only signatures/results cross
- Content script validates every message against a strict schema before forwarding
- Popup cannot directly access storage; must request through SW
- CSP: no `eval`, no `Function()`, no dynamic imports, no inline scripts

## Recommended Project Structure

```
src/
├── background/            # Service worker entry
│   ├── index.ts           # SW bootstrap, event listeners
│   ├── controllers/
│   │   ├── keyring.ts     # BIP-39/44, vault encrypt/decrypt
│   │   ├── transaction.ts # Build, sign, broadcast, track
│   │   ├── network.ts     # RPC client, WebSocket manager
│   │   ├── permission.ts  # Per-origin dapp permissions
│   │   └── wallet.ts      # Account state, lock/unlock
│   ├── rpc-router.ts      # Route EIP-1193 methods to controllers
│   └── ws-manager.ts      # WebSocket lifecycle, reconnect, keepalive
├── content/               # Content script
│   ├── index.ts           # Message relay, validation
│   └── inpage.ts          # Injected into page world (window.ethereum)
├── popup/                 # React popup UI
│   ├── App.tsx
│   ├── pages/
│   │   ├── Unlock.tsx
│   │   ├── Home.tsx       # Balances, activity
│   │   ├── Send.tsx
│   │   └── Confirm.tsx    # Tx approval
│   ├── hooks/
│   │   └── useBackground.ts  # chrome.runtime messaging hooks
│   ├── store/             # Zustand stores (UI state only)
│   └── components/        # shadcn/ui components
├── shared/                # Code shared across contexts
│   ├── types.ts           # Message schemas, RPC types
│   ├── constants.ts       # Chain configs, contract addresses
│   └── messages.ts        # Message type enums, validators
├── crypto/                # Pure crypto utilities
│   ├── keyring.ts         # @noble/secp256k1, @scure/bip39
│   ├── encryption.ts      # AES-256-GCM vault operations
│   └── signing.ts         # Transaction signing
└── manifest.json
```

### Structure Rationale

- **background/controllers/**: Each controller owns one domain. SW is the only context with crypto access
- **content/ + inpage.ts**: Inpage is injected via `"world": "MAIN"` in manifest; content script runs in isolated world. Two separate files, two separate trust levels
- **popup/**: Standard React app communicating exclusively through `chrome.runtime`; holds zero crypto logic
- **shared/**: Message schemas and constants shared across build targets (background, content, popup are separate bundles)
- **crypto/**: Pure functions with no side effects, fully testable, imported only by background

## Architectural Patterns

### Pattern 1: Tiered Storage (Vault + Session + Ephemeral)

**What:** Three-tier storage isolating data by sensitivity and lifetime
**When to use:** Always in wallet extensions
**Trade-offs:** Complexity vs security. Worth it.

```
┌──────────────────┐
│ chrome.storage   │  Encrypted vault (AES-256-GCM + PBKDF2 600k rounds)
│ .local           │  Persists forever. Contains seed cipher + preferences.
├──────────────────┤
│ chrome.storage   │  Derived session key (from password at unlock).
│ .session         │  Survives SW restart. Clears on browser close.
├──────────────────┤
│ In-Memory        │  Decrypted private key bytes (Uint8Array).
│ (SW globals)     │  Exists only during signing. Zeroed in finally{}.
└──────────────────┘
```

**Critical detail:** `chrome.storage.session` survives service worker idle termination but clears when the browser closes. This means the wallet stays unlocked across SW restarts within a browser session, without re-prompting for password. The encrypted vault in `.local` persists across browser restarts but requires password to unlock.

### Pattern 2: Message Bus with Schema Validation

**What:** All cross-context communication uses typed, validated message envelopes
**When to use:** Every message between inpage, content script, SW, and popup

```typescript
// shared/messages.ts
type MessageType =
  | 'RPC_REQUEST'       // EIP-1193 call from dapp
  | 'RPC_RESPONSE'      // Response back to dapp
  | 'POPUP_REQUEST'     // Popup asking SW for data
  | 'POPUP_RESPONSE'    // SW responding to popup
  | 'STATE_UPDATE'      // SW broadcasting state changes
  | 'TX_APPROVAL'       // Popup approving/rejecting tx

interface Message<T extends MessageType> {
  type: T;
  id: string;        // UUID for request/response correlation
  payload: unknown;   // Validated per type
  origin?: string;    // Set by content script
}
```

**Trade-offs:** Boilerplate vs safety. Message validation prevents injection attacks from malicious pages.

### Pattern 3: WebSocket Manager with Reconnection

**What:** Centralized WebSocket lifecycle management in the service worker handling megaETH's keepalive requirements and Chrome's idle timer
**When to use:** For stateChanges subscriptions and realtime balance updates

```typescript
// background/ws-manager.ts
class WebSocketManager {
  private ws: WebSocket | null = null;
  private keepaliveId: number | null = null;
  private subscriptions: Map<string, string[]> = new Map(); // id → addresses

  connect(url: string) {
    this.ws = new WebSocket(url);
    this.ws.onopen = () => this.startKeepalive();
    this.ws.onclose = () => this.scheduleReconnect();
    this.ws.onmessage = (e) => this.handleMessage(e);
  }

  // megaETH requires eth_chainId every 30s; Chrome 116+ resets
  // SW idle timer on WS message. 20s interval satisfies both.
  private startKeepalive() {
    this.keepaliveId = setInterval(() => {
      this.ws?.send(JSON.stringify({
        jsonrpc: '2.0', method: 'eth_chainId', params: [], id: 0
      }));
    }, 20_000);
  }
}
```

**Trade-offs:** Chrome 116+ keeps SW alive with active WS messages, but SW can still die on Chrome update/crash. Must persist subscription list to `chrome.storage.session` and resubscribe on SW restart.

### Pattern 4: Provider Injection (EIP-1193 + EIP-6963)

**What:** Dual provider discovery — legacy `window.ethereum` and modern EIP-6963 event-based
**When to use:** Always. EIP-6963 prevents wallet collision; `window.ethereum` for backward compat.

```typescript
// content/inpage.ts (injected into MAIN world)
const provider = new MegaWalletProvider(); // implements EIP-1193

// Legacy injection
window.ethereum = provider;

// EIP-6963 announcement
window.dispatchEvent(new CustomEvent('eip6963:announceProvider', {
  detail: Object.freeze({
    info: {
      uuid: crypto.randomUUID(),
      name: 'MegaWallet',
      icon: 'data:image/svg+xml;base64,...',
      rdns: 'dev.emptystring.megawallet'
    },
    provider
  })
}));

// Re-announce on discovery request
window.addEventListener('eip6963:requestProvider', () => {
  window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { ... }));
});
```

## Data Flow

### Flow 1: Dapp RPC Request (e.g., eth_sendTransaction)

```
DApp calls window.ethereum.request({ method: 'eth_sendTransaction', params })
    │
    ▼
Inpage Provider → window.postMessage({ type: 'RPC_REQUEST', id, payload })
    │
    ▼
Content Script receives message event
    ├── Validate origin matches tab URL
    ├── Validate message schema
    ├── Rate-limit check
    │
    ▼
chrome.runtime.sendMessage({ type: 'RPC_REQUEST', id, payload, origin })
    │
    ▼
Service Worker RPC Router
    ├── Check permission for origin
    ├── Route to TransactionController
    │   ├── Build tx (gas estimation via megaETH RPC)
    │   ├── Open popup for user approval
    │   │       ▼
    │   │   Popup shows tx details → User approves
    │   │       ▼
    │   ├── Sign tx (decrypt key from vault → sign → zero key)
    │   ├── Broadcast via realtime_sendRawTransaction
    │   └── Return receipt
    │
    ▼
Response flows back: SW → Content Script → Inpage → DApp
```

### Flow 2: Real-Time Balance Update (megaETH stateChanges)

```
Service Worker boots / user unlocks wallet
    │
    ▼
WebSocketManager.connect(wss://mainnet.megaeth.com/ws)
    │
    ▼
Subscribe: eth_subscribe("stateChanges", [userAddress])
    │
    ▼
megaETH pushes on every mini-block affecting address:
  { address, nonce, balance, storage: { slot: value } }
    │
    ▼
SW updates cached balance in Zustand/state
    ├── Notify popup (if open) via chrome.runtime port
    └── Keepalive: eth_chainId every 20s (satisfies megaETH 30s + Chrome idle)
```

### Flow 3: Transaction with Instant Confirmation (megaETH Realtime)

```
User clicks Send in Popup
    │
    ▼
Popup → chrome.runtime.sendMessage → SW TransactionController
    │
    ▼
1. Build tx: { to, value, gas: 60000+, gasPrice via eth_gasPrice }
   (megaETH minimum gas = 60k, not 21k like mainnet Ethereum)
    │
    ▼
2. Sign with decrypted key (Uint8Array, zeroed after)
    │
    ▼
3. realtime_sendRawTransaction(signedTx)
   Returns receipt in single call — no polling needed
   Times out after 10s if no confirmation
    │
    ▼
4. Update UI: preconfirmed → show receipt immediately
   (vs traditional: send → poll getTransactionReceipt)
```

### Flow 4: Wallet Unlock

```
User opens popup → sees lock screen
    │
    ▼
User enters password → Popup sends to SW
    │
    ▼
SW WalletController:
  1. Read encrypted vault from chrome.storage.local
  2. Derive decryption key: PBKDF2(password, salt, 600k iterations)
  3. Decrypt vault (AES-256-GCM)
  4. Store derived session key in chrome.storage.session
     (survives SW restart, clears on browser close)
  5. DO NOT store decrypted seed/keys — only session key
    │
    ▼
SW is now "unlocked" — can decrypt individual keys on-demand for signing
Popup receives unlock confirmation, navigates to Home
```

## megaETH Realtime API Integration

### Network Configuration

| Network | Chain ID | HTTP RPC | WebSocket | Explorer |
|---------|----------|----------|-----------|----------|
| Mainnet | 4326 | `https://mainnet.megaeth.com/rpc` | `wss://megaeth.drpc.org` | `https://megaeth.blockscout.com` |
| Testnet | 6342 | `https://carrot.megaeth.com/rpc` | `wss://carrot.megaeth.com/ws` | `https://megaeth-testnet-v2.blockscout.com` |

### megaETH-Specific Architecture Concerns

| Concern | Standard Ethereum | megaETH Difference | Wallet Impact |
|---------|-------------------|--------------------|----|
| Block time | ~12s | 10ms mini-blocks, 1s EVM blocks | Balance updates are near-instant; UI must handle rapid state changes |
| Gas minimum | 21,000 | 60,000 | Must override default gas estimation; MetaMask/Rabby fail here |
| Gas estimation | Local simulation OK | Must use RPC `eth_estimateGas` | Never estimate locally; always call megaETH's RPC |
| Tx submission | `eth_sendRawTransaction` + poll receipt | `realtime_sendRawTransaction` returns receipt in one call | No polling loop needed; 10s timeout on failure |
| Balance queries | `eth_getBalance` with `latest` | `stateChanges` WebSocket subscription | Real-time push vs pull; requires persistent WS |
| Base fee | ~30 gwei | 0.001 gwei (10^6 wei) | Tx costs nearly zero; UI should show sub-gwei amounts |
| Finality | 12s + epochs | Preconfirmed (instant) → L1 settled (later) | Show finality indicator in UI |

### WebSocket Lifecycle in Service Worker

```
SW starts (install/activate or wake from idle)
    │
    ▼
Check chrome.storage.session for:
  - isUnlocked? → if no, skip WS
  - activeSubscriptions? → addresses to resubscribe
    │
    ▼
Connect WebSocket → subscribe stateChanges for each address
    │
    ▼
Keepalive loop (20s interval):
  - Send eth_chainId (megaETH requires every 30s)
  - This also resets Chrome's 30s SW idle timer
    │
    ▼
On WS close/error:
  - Exponential backoff reconnect (1s, 2s, 4s, 8s, max 30s)
  - Persist subscription list to chrome.storage.session
  - On reconnect: resubscribe all addresses
    │
    ▼
On SW termination (Chrome kill):
  - WS closes automatically
  - Subscriptions already persisted in chrome.storage.session
  - Next SW wake: reconnect + resubscribe
```

### EIP-7702 Integration (Post-MVP)

EIP-7702 adds tx type `0x04` allowing EOAs to temporarily delegate to smart contract code. Architecture impact:

- **TransactionController** gains a `buildBatchTransaction()` method
- Authorization list (signed delegation) attached to transaction
- Enables atomic approve+swap, multi-send, gas sponsorship
- Signing flow unchanged (same key, new tx type envelope)
- Build as progressive enhancement: basic EOA first, 7702 layered on

## Anti-Patterns

### Anti-Pattern 1: Storing Decrypted Keys in chrome.storage

**What people do:** Store decrypted private keys or seed in `chrome.storage.session` for convenience
**Why it's wrong:** `chrome.storage.session` is accessible to any extension context with the right `setAccessLevel`. If a content script vulnerability exists, keys are exposed. Session storage is inspectable via DevTools.
**Do this instead:** Store only the derived session encryption key in `.session`. Decrypt individual private keys into `Uint8Array` in-memory only during signing, zero immediately after.

### Anti-Pattern 2: Single Background Bundle with Popup

**What people do:** Bundle SW and popup into one script or share global state
**Why it's wrong:** Different lifecycle. SW terminates on idle; popup lives only while open. Shared globals cause undefined behavior.
**Do this instead:** Separate esbuild entry points. Popup communicates with SW exclusively via `chrome.runtime.sendMessage` or ports.

### Anti-Pattern 3: Polling for Balance Updates

**What people do:** `setInterval(() => eth_getBalance(...), 5000)`
**Why it's wrong:** On megaETH with 10ms blocks, polling misses updates and wastes RPC quota
**Do this instead:** Subscribe to `stateChanges` via WebSocket. Get push updates on every mini-block affecting the address.

### Anti-Pattern 4: Using window.ethereum Without EIP-6963

**What people do:** Only set `window.ethereum`, overwriting other wallets
**Why it's wrong:** Causes wallet collision. Users with MetaMask + MegaWallet get unpredictable behavior.
**Do this instead:** Implement EIP-6963 `announceProvider` event. Keep `window.ethereum` as fallback for legacy dapps.

### Anti-Pattern 5: Local Gas Estimation on megaETH

**What people do:** Use local EVM simulation (like ethers.js default) to estimate gas
**Why it's wrong:** megaETH's MegaEVM has different gas costs than standard EVM. Local estimation returns wrong values. 21k gas limit will fail; minimum is 60k.
**Do this instead:** Always call `eth_estimateGas` against megaETH's RPC. Hardcode 60k minimum floor.

## Build Order (Dependency Graph)

Build order determined by which components other components depend on:

```
Phase 1: Foundation (no external dependencies)
  ├── shared/types + messages     ← everything depends on message schemas
  ├── crypto/ (keyring, encrypt)  ← SW depends on this
  └── manifest.json + esbuild     ← build pipeline

Phase 2: Core Service Worker
  ├── background/controllers/keyring   ← depends on crypto/
  ├── background/controllers/wallet    ← depends on keyring
  ├── chrome.storage integration       ← vault persistence
  └── background/controllers/network   ← HTTP RPC client

Phase 3: Provider + Content Script
  ├── content/inpage.ts (EIP-1193)     ← depends on shared/messages
  ├── content/index.ts (relay)         ← depends on shared/messages
  └── background/rpc-router.ts         ← depends on all controllers

Phase 4: Popup UI
  ├── Unlock flow                      ← depends on wallet controller
  ├── Send flow                        ← depends on tx controller
  ├── Confirm/Sign flow                ← depends on permission controller
  └── Home (balance display)           ← depends on network controller

Phase 5: megaETH Realtime
  ├── background/ws-manager.ts         ← depends on network controller
  ├── stateChanges subscription        ← depends on ws-manager
  ├── realtime_sendRawTransaction      ← depends on tx controller
  └── Finality indicators in UI        ← depends on popup

Phase 6: Advanced
  ├── EIP-7702 batch transactions      ← depends on tx controller
  ├── ERC-20 token support             ← depends on stateChanges (storage slots)
  └── Transaction simulation           ← depends on network controller
```

**Key dependency insight:** Phases 1-2 are pure backend with no UI — fully testable via TDD before any UI exists. Phase 3 (provider) can be tested against dapp test harnesses. Phase 4 (popup) is cosmetic until phases 1-3 work. Phase 5 (realtime) is the megaETH differentiator but depends on core wallet working first.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| megaETH HTTP RPC | viem `publicClient` or raw fetch | Use `eth_estimateGas`, `eth_getBalance`, `eth_sendRawTransaction` |
| megaETH WebSocket | Native `WebSocket` in SW | `stateChanges` subscription, 20s keepalive with `eth_chainId` |
| megaETH Realtime RPC | `realtime_sendRawTransaction` | Returns receipt in one call; 10s timeout |
| Block Explorer API | REST (Blockscout/Etherscan) | Tx history, token lists; not latency-sensitive |
| mega-tokenlist | Static JSON fetch | ERC-20 token metadata; cache in `chrome.storage.local` |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Inpage ↔ Content Script | `window.postMessage` | Schema-validated, rate-limited |
| Content Script ↔ SW | `chrome.runtime.sendMessage` / `chrome.runtime.connect` (port) | Port for streaming updates |
| Popup ↔ SW | `chrome.runtime.sendMessage` / port | Port stays open while popup visible |
| SW ↔ Storage | `chrome.storage.local.get/set` | Async, encrypted vault |
| SW ↔ megaETH | HTTP fetch + WebSocket | Separate clients for RPC vs realtime |

## Sources

- [Chrome Manifest V3 Service Worker Lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) — HIGH confidence
- [chrome.storage API Reference](https://developer.chrome.com/docs/extensions/reference/api/storage) — HIGH confidence
- [WebSockets in Extension Service Workers](https://developer.chrome.com/docs/extensions/how-to/web-platform/websockets) — HIGH confidence
- [EIP-1193: Ethereum Provider JavaScript API](https://eips.ethereum.org/EIPS/eip-1193) — HIGH confidence
- [EIP-6963: Multi Injected Provider Discovery](https://eips.ethereum.org/EIPS/eip-6963) — HIGH confidence
- [megaETH Realtime API](https://docs.megaeth.com/realtime-api) — HIGH confidence
- [megaETH RPC Documentation](https://docs.megaeth.com/rpc) — HIGH confidence
- [megaETH Mainnet Config (ChainList)](https://chainlist.org/chain/4326) — MEDIUM confidence
- [megaETH Testnet Config (ChainList)](https://chainlist.org/chain/6342) — MEDIUM confidence
- [Nadcab Wallet Extension Architecture Guide](https://www.nadcab.com/blog/secure-crypto-wallet-browser-extension-architecture-guide) — MEDIUM confidence
- [EIP-7702 Implementation](https://www.quicknode.com/guides/ethereum-development/smart-contracts/eip-7702-smart-accounts) — MEDIUM confidence

---
*Architecture research for: Chrome MV3 Crypto Wallet (megaETH)*
*Researched: 2026-03-01*
