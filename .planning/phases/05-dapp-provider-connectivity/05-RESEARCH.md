# Phase 5: Dapp Provider & Connectivity - Research

**Researched:** 2026-03-01
**Domain:** Chrome Extension dapp provider (EIP-1193, EIP-6963), message signing, dapp transaction confirmation
**Confidence:** HIGH

## Summary

This phase implements the standard Ethereum dapp connectivity layer: an EIP-1193 provider injected into web pages, EIP-6963 multi-wallet discovery, and the approval/signing UX flows triggered by dapp requests. The architecture follows the well-established three-layer Chrome extension pattern: inpage provider (MAIN world) -> content script relay (ISOLATED world) -> background service worker.

The existing codebase is well-prepared. `content.ts` already injects `inpage.js` into MAIN world. `inpage.ts` is a placeholder awaiting the EIP-1193 provider. `background.ts` has an extensible message handler. `micro-eth-signer` v0.18.1 (already installed) exports `eip191Signer` (personal_sign), `signTyped` (EIP-712), and `decodeData` from `advanced/abi.js` (calldata decoding with human-readable hints).

**Primary recommendation:** Build inpage provider as standalone IIFE, relay through content script via window.postMessage with unique channel prefix, handle approval popups via chrome.windows.create in background.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Popup window opens for eth_requestAccounts -- standard MetaMask pattern
- Show rich metadata: favicon, site name, description from page meta tags
- Account picker: show checkboxes for all derived accounts, user selects which to share
- Connected sites persist until explicitly revoked (stored in chrome.storage.local)
- personal_sign: syntax-highlighted rendering -- detect structure (JSON, hex, ASCII) and format accordingly
- signTypedData_v4 (EIP-712): structured tree view showing domain, primary type, and message fields nested with type labels
- Permit signatures: red warning banner at top ("This grants token spending approval") with spender address, token, amount, deadline in highlighted fields
- eth_sign blocked by default: error message with "Enable in Advanced Settings" link per DAPP-09
- Separate dapp confirm screen (NOT reusing SendConfirmScreen) -- shows dapp origin, contract details, decoded function call
- Simulation preview: balance diff preview via eth_call -- compare token/ETH balance changes, show "You will send X ETH and receive Y TOKEN"
- Basic function decoding: attempt to decode common selectors (transfer, approve, swap), fallback to raw hex data
- Editable gas fields: advanced toggle to override gasLimit, maxFeePerGas, maxPriorityFeePerGas
- Dedicated "Connections" screen accessible from settings AND header icon
- Each entry shows: favicon, origin URL, connected accounts, connection timestamp, disconnect button
- "Disconnect All" button at bottom with confirmation dialog
- Green dot + truncated site name in popup header when on a connected dapp

### Claude's Discretion
- Content script <-> background message relay implementation details
- EIP-6963 provider info metadata fields
- RPC method whitelist composition (DAPP-10)
- wallet_switchEthereumChain rejection message wording
- Exact popup window dimensions and positioning
- Function selector database scope (how many common selectors to include)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DAPP-01 | Content script injects EIP-1193 compatible window.ethereum provider | EIP-1193 spec fully documented; inpage.ts already exists as IIFE bundle target; provider interface: `request({method, params}) -> Promise` |
| DAPP-02 | EIP-6963 multi-wallet discovery via event-based provider announcement | EIP-6963 spec: dispatch `eip6963:announceProvider` with frozen detail, listen for `eip6963:requestProvider`; ProviderInfo: uuid, name, icon, rdns |
| DAPP-03 | eth_requestAccounts with user approval dialog for dapp connection | chrome.windows.create popup for approval; pending request queue in background; connected sites in chrome.storage.local |
| DAPP-04 | eth_sendTransaction with full confirmation flow and simulation preview | Dapp tx confirmation popup; eth_call for balance diff simulation; decodeData from micro-eth-signer/advanced/abi.js for function decoding |
| DAPP-05 | personal_sign with clear display of message content | eip191Signer.sign from micro-eth-signer main export; display with structure detection |
| DAPP-06 | eth_signTypedData_v4 with structured data display; Permit signatures get extra warning | signTyped from micro-eth-signer; detect Permit by primaryType; structured tree view |
| DAPP-07 | eth_chainId, eth_accounts, net_version for chain/account queries | Direct responses from background state; chainId from NETWORKS config (4326 mainnet, 6343 testnet) |
| DAPP-08 | wallet_switchEthereumChain -- accept megaETH chains only | Check chainId against known megaETH chains; reject with error code 4902 for unknown chains |
| DAPP-09 | eth_sign blocked by default with explanation | Return error code 4200 with message; settings toggle in chrome.storage.local |
| DAPP-10 | Provider validates all requests against whitelist of supported RPC methods | Whitelist map in provider; return 4200 for unsupported methods |
| DAPP-11 | No internal wallet state accessible from provider object | Provider is frozen object in MAIN world; only exposes request() and event methods; content script relay strips all internal data |
| TEST-05 | Provider isolation test: no message from content script contains key material | Unit test scanning all dapp message types for absence of seed/privateKey/mnemonic fields |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| micro-eth-signer | 0.18.1 | personal_sign (eip191Signer), signTyped (EIP-712), decodeData (ABI) | Already installed; covers all signing + decoding needs |
| Chrome Extensions API | MV3 | chrome.windows.create, chrome.runtime messaging, chrome.storage | Native platform API; no polyfill needed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| crypto.randomUUID() | Web API | Generate EIP-6963 UUID | Browser built-in, no dependency |
| micro-eth-signer/advanced/abi.js | 0.18.1 | decodeData() for calldata decoding with human hints | Dapp tx confirmation to decode function calls |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled ABI decode | micro-eth-signer/advanced/abi.js | Already installed, covers ERC20+Uniswap+common selectors with hints |
| External 4byte API | Built-in selector DB in micro-eth-signer | No network dependency, works offline, deterministic |

**Installation:**
```bash
# No new dependencies required -- everything needed is already installed
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── entrypoints/
│   ├── inpage.ts              # EIP-1193 provider + EIP-6963 (IIFE, MAIN world)
│   ├── content.ts             # Message relay (ISOLATED world)
│   └── background.ts          # Add dapp message handlers
├── features/
│   ├── dapp/
│   │   ├── types.ts           # DappMessage/DappResponse unions, ConnectedSite
│   │   ├── provider.ts        # EIP-1193 provider class (used by inpage.ts)
│   │   ├── rpc-whitelist.ts   # Supported method whitelist
│   │   ├── decode.ts          # Calldata decoding wrapper
│   │   └── permit-detect.ts   # Permit signature detection
│   ├── ui/
│   │   ├── screens/
│   │   │   ├── DappConnectScreen.tsx    # Connection approval
│   │   │   ├── DappSignScreen.tsx       # personal_sign + signTypedData display
│   │   │   ├── DappConfirmScreen.tsx    # Transaction confirmation + simulation
│   │   │   └── ConnectionsScreen.tsx    # Manage connected sites
│   │   └── components/
│   │       └── ConnectionIndicator.tsx  # Green dot in header
│   └── wallet/
│       └── types.ts           # Extend WalletMessage/WalletResponse unions
```

### Pattern 1: Three-Layer Message Relay
**What:** Inpage (MAIN) -> Content Script (ISOLATED) -> Background (Service Worker)
**When to use:** All dapp-initiated RPC calls

```typescript
// Inpage: post to content script via window.postMessage
const CHANNEL = 'megawallet-provider';
window.postMessage({ channel: CHANNEL, id: requestId, method, params }, '*');

// Content script: relay to background via chrome.runtime
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (event.data?.channel !== CHANNEL) return;
  chrome.runtime.sendMessage(
    { type: 'dapp:rpc', ...event.data, origin: window.location.origin },
    (response) => {
      window.postMessage({ channel: CHANNEL, id: event.data.id, response }, '*');
    }
  );
});

// Background: handle dapp message, open popup if approval needed
```

### Pattern 2: Approval Popup via chrome.windows.create
**What:** Open popup.html in a new window for dapp approval requests
**When to use:** eth_requestAccounts, eth_sendTransaction, personal_sign, eth_signTypedData_v4

```typescript
// Background: open approval popup
async function openApprovalPopup(requestId: string, type: string): Promise<void> {
  // Store pending request in chrome.storage.session
  await chrome.storage.session.set({
    pendingDappRequest: { id: requestId, type, /* ... */ }
  });

  const popup = await chrome.windows.create({
    url: chrome.runtime.getURL('popup.html#dapp-approve'),
    type: 'popup',
    width: 360,
    height: 600,
    focused: true,
  });

  // Listen for window close -> reject pending request
  if (popup.id) {
    chrome.windows.onRemoved.addListener(function onClose(windowId) {
      if (windowId === popup.id) {
        chrome.windows.onRemoved.removeListener(onClose);
        rejectPendingRequest(requestId, 4001, 'User rejected');
      }
    });
  }
}
```

### Pattern 3: EIP-6963 Provider Announcement
**What:** Announce wallet via custom events for multi-wallet discovery
**When to use:** Immediately on inpage script load

```typescript
// Source: EIP-6963 specification
const info: EIP6963ProviderInfo = {
  uuid: crypto.randomUUID(),
  name: 'megawallet',
  icon: 'data:image/svg+xml,...', // Base64 or SVG data URI
  rdns: 'com.megawallet',
};

const detail = Object.freeze({ info, provider });

window.dispatchEvent(
  new CustomEvent('eip6963:announceProvider', { detail })
);

window.addEventListener('eip6963:requestProvider', () => {
  window.dispatchEvent(
    new CustomEvent('eip6963:announceProvider', { detail })
  );
});
```

### Pattern 4: Pending Request Queue
**What:** Queue dapp requests requiring user approval; resolve/reject when popup responds
**When to use:** Any RPC method that needs user interaction

```typescript
// Background: pending request store
const pendingRequests = new Map<string, {
  resolve: (result: unknown) => void;
  reject: (error: { code: number; message: string }) => void;
  origin: string;
  method: string;
  params: unknown;
}>();
```

### Anti-Patterns to Avoid
- **Passing provider object between worlds:** The inpage provider MUST be constructed in MAIN world. Never try to serialize/pass a provider instance through content script.
- **Using chrome.runtime.sendMessage from inpage:** Inpage runs in MAIN world and has NO access to Chrome extension APIs. Must use window.postMessage to content script.
- **Storing connected sites in session storage:** Connected sites must persist across browser restarts. Use chrome.storage.local, not session.
- **Blocking on popup response:** Background must use Promise-based pending queue, not synchronous waiting. Service worker can be suspended.
- **Exposing internal state on provider object:** Provider must be Object.freeze()'d. Only expose request(), on(), removeListener(). No isUnlocked, no selectedAddress.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| EIP-191 personal message signing | Custom hash+sign | `eip191Signer.sign()` from micro-eth-signer | Handles prefix bytes, hashing, recovery ID correctly |
| EIP-712 typed data signing | Custom struct hash | `signTyped()` from micro-eth-signer | Recursive type hashing is complex, tested against spec vectors |
| ABI/calldata decoding | Custom 4byte lookup | `decodeData()` from micro-eth-signer/advanced/abi.js | Includes ERC20, Uniswap V2/V3, WETH, common selectors with human hints |
| UUID generation | Custom UUID | `crypto.randomUUID()` | Browser built-in, RFC 4122 v4 compliant |
| EIP-1193 error codes | Magic numbers | Named constants map | Prevents typos, self-documenting |

**Key insight:** micro-eth-signer already bundles everything needed for signing and decoding. Adding external libraries or APIs would add complexity without benefit.

## Common Pitfalls

### Pitfall 1: Content Script Message Origin Spoofing
**What goes wrong:** Malicious page sends crafted postMessage that looks like legitimate provider request
**Why it happens:** window.postMessage is public; any script on the page can send messages
**How to avoid:** (1) Use unique channel prefix to filter messages. (2) Always check `event.source === window`. (3) Content script attaches `window.location.origin` before forwarding to background -- background uses THIS origin, never trusts origin from the message payload itself.
**Warning signs:** Tests pass but dapp security audit fails

### Pitfall 2: Service Worker Suspension Drops Pending Requests
**What goes wrong:** Background opens approval popup, service worker is suspended, user approves, but the resolve callback is gone
**Why it happens:** MV3 service workers can be terminated after 30s of inactivity
**How to avoid:** Store pending request data in chrome.storage.session (survives suspension). When popup sends approval, background re-hydrates the request and responds to content script via a stored port or by having content script poll.
**Warning signs:** Intermittent "no response" from dapp requests

### Pitfall 3: Popup URL Fragment Routing
**What goes wrong:** chrome.windows.create opens popup.html but shows MainScreen instead of approval screen
**Why it happens:** App.tsx reads screen from zustand store, not URL
**How to avoid:** Use URL hash (popup.html#dapp-connect) or query params to signal approval mode. Check window.location.hash in popup initialization to set correct initial screen. OR store the pending request type in session storage and have the popup detect it.
**Warning signs:** Popup opens but shows wallet home instead of approval dialog

### Pitfall 4: Race Condition in EIP-6963 Announcement
**What goes wrong:** Dapp listens for eip6963:announceProvider AFTER wallet announces, misses wallet
**Why it happens:** Script execution order is unpredictable
**How to avoid:** EIP-6963 spec requires wallets to BOTH (1) announce on load AND (2) listen for eip6963:requestProvider and re-announce. Both are mandatory.
**Warning signs:** Wallet sometimes not discovered by dapps

### Pitfall 5: window.ethereum Conflict with Other Wallets
**What goes wrong:** Setting window.ethereum overwrites other wallet's provider
**Why it happens:** Legacy pattern of provider injection
**How to avoid:** Set window.ethereum for backward compatibility but ALSO implement EIP-6963. Use defineProperty with configurable:true so other wallets can also set it. The EIP-6963 path is the non-conflicting discovery mechanism.
**Warning signs:** Users with multiple wallets report one wallet overriding the other

### Pitfall 6: Key Material Leaking Through Dapp Messages
**What goes wrong:** Background handler accidentally includes seed/privateKey in response
**Why it happens:** Reusing internal wallet response types that carry key material
**How to avoid:** Dapp message types must be a SEPARATE union from wallet message types. Never reuse WalletResponse for dapp responses. TEST-05 specifically requires a test scanning for key material in dapp messages.
**Warning signs:** Security audit failure

### Pitfall 7: BigInt Serialization in postMessage
**What goes wrong:** window.postMessage throws on BigInt values
**Why it happens:** structured clone algorithm doesn't support BigInt in older contexts; JSON.stringify fails on BigInt
**How to avoid:** All values crossing message boundaries must be hex strings (0x-prefixed). Already established pattern from Phase 4.
**Warning signs:** "BigInt is not serializable" errors in console

## Code Examples

### EIP-1193 Provider Implementation
```typescript
// Source: EIP-1193 spec + existing codebase patterns
interface RequestArguments {
  readonly method: string;
  readonly params?: readonly unknown[] | object;
}

interface ProviderRpcError extends Error {
  code: number;
  data?: unknown;
}

const RPC_ERRORS = {
  USER_REJECTED: { code: 4001, message: 'User rejected the request' },
  UNAUTHORIZED: { code: 4100, message: 'Unauthorized' },
  UNSUPPORTED: { code: 4200, message: 'Unsupported method' },
  DISCONNECTED: { code: 4900, message: 'Disconnected' },
  CHAIN_DISCONNECTED: { code: 4901, message: 'Chain disconnected' },
} as const;

class MegaWalletProvider {
  private _listeners: Map<string, Set<Function>> = new Map();
  private _requestId = 0;
  private _pendingRequests = new Map<number, { resolve: Function; reject: Function }>();

  async request(args: RequestArguments): Promise<unknown> {
    const id = ++this._requestId;
    return new Promise((resolve, reject) => {
      this._pendingRequests.set(id, { resolve, reject });
      window.postMessage({
        channel: 'megawallet-provider',
        id,
        method: args.method,
        params: args.params,
      }, '*');
    });
  }

  on(event: string, listener: Function): this {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event)!.add(listener);
    return this;
  }

  removeListener(event: string, listener: Function): this {
    this._listeners.get(event)?.delete(listener);
    return this;
  }

  // Internal: handle response from content script
  _handleResponse(id: number, result: unknown, error?: { code: number; message: string }) {
    const pending = this._pendingRequests.get(id);
    if (!pending) return;
    this._pendingRequests.delete(id);
    if (error) {
      const err = new Error(error.message) as ProviderRpcError;
      err.code = error.code;
      pending.reject(err);
    } else {
      pending.resolve(result);
    }
  }
}
```

### Content Script Relay
```typescript
// Source: Chrome extension messaging patterns
const CHANNEL = 'megawallet-provider';

// Page -> Background relay
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (event.data?.channel !== CHANNEL) return;
  if (event.data.direction !== 'to-background') return;

  chrome.runtime.sendMessage(
    {
      type: 'dapp:rpc',
      id: event.data.id,
      method: event.data.method,
      params: event.data.params,
      origin: window.location.origin,
    },
    (response) => {
      if (chrome.runtime.lastError) {
        window.postMessage({
          channel: CHANNEL,
          direction: 'to-page',
          id: event.data.id,
          error: { code: 4900, message: 'Extension disconnected' },
        }, '*');
        return;
      }
      window.postMessage({
        channel: CHANNEL,
        direction: 'to-page',
        id: event.data.id,
        ...response,
      }, '*');
    }
  );
});

// Background -> Page relay (for events like accountsChanged, chainChanged)
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'dapp:event') {
    window.postMessage({
      channel: CHANNEL,
      direction: 'to-page',
      event: msg.event,
      data: msg.data,
    }, '*');
  }
});
```

### Signing: personal_sign
```typescript
// Source: micro-eth-signer v0.18.1 API
import { eip191Signer } from 'micro-eth-signer';

// In background handler
function handlePersonalSign(message: string, privateKey: Uint8Array): string {
  // message is hex-encoded UTF-8 from dapp
  const decoded = hexToUtf8(message);
  return eip191Signer.sign(decoded, privateKey);
}
```

### Signing: eth_signTypedData_v4
```typescript
// Source: micro-eth-signer v0.18.1 API
import { signTyped } from 'micro-eth-signer';

function handleSignTypedData(typedData: TypedData, privateKey: Uint8Array): string {
  return signTyped(typedData, privateKey);
}
```

### Permit Signature Detection
```typescript
// Source: EIP-2612 spec
const PERMIT_PRIMARY_TYPES = new Set([
  'Permit',          // EIP-2612 standard
  'PermitSingle',    // Permit2
  'PermitBatch',     // Permit2 batch
]);

function isPermitSignature(typedData: { primaryType: string }): boolean {
  return PERMIT_PRIMARY_TYPES.has(typedData.primaryType);
}
```

### Calldata Decoding
```typescript
// Source: micro-eth-signer/advanced/abi.js Context7 docs
import { decodeData } from 'micro-eth-signer/advanced/abi.js';

function decodeCalldata(to: string, data: string, value: bigint): {
  name?: string;
  signature?: string;
  hint?: string;
  raw: string;
} {
  try {
    const decoded = decodeData(to, data, value);
    return { ...decoded, raw: data };
  } catch {
    return { raw: data };
  }
}
```

### RPC Method Whitelist
```typescript
// Source: DAPP-10 requirement + standard Ethereum JSON-RPC
const RPC_WHITELIST: Record<string, 'direct' | 'approval' | 'blocked'> = {
  // Direct (no approval needed)
  eth_chainId: 'direct',
  eth_accounts: 'direct',
  net_version: 'direct',
  eth_blockNumber: 'direct',
  eth_getBalance: 'direct',
  eth_getCode: 'direct',
  eth_getTransactionCount: 'direct',
  eth_getStorageAt: 'direct',
  eth_call: 'direct',
  eth_estimateGas: 'direct',
  eth_gasPrice: 'direct',
  eth_getBlockByNumber: 'direct',
  eth_getBlockByHash: 'direct',
  eth_getTransactionByHash: 'direct',
  eth_getTransactionReceipt: 'direct',
  eth_getLogs: 'direct',
  eth_maxPriorityFeePerGas: 'direct',
  eth_feeHistory: 'direct',
  web3_clientVersion: 'direct',

  // Approval required
  eth_requestAccounts: 'approval',
  eth_sendTransaction: 'approval',
  personal_sign: 'approval',
  eth_signTypedData_v4: 'approval',
  wallet_switchEthereumChain: 'approval',

  // Blocked
  eth_sign: 'blocked',
};
```

### Balance Diff Simulation via eth_call
```typescript
// Source: eth_call spec + existing rpcCall helper
async function simulateTransaction(
  network: 'mainnet' | 'testnet',
  from: string,
  to: string,
  data: string,
  value: string,
): Promise<{ ethBefore: bigint; ethAfter: bigint }> {
  // Fetch balance before
  const balanceHex = await rpcCall(network, 'eth_getBalance', [from, 'latest']);
  const ethBefore = BigInt(balanceHex as string);

  // Simulate via eth_call (doesn't modify state)
  await rpcCall(network, 'eth_call', [{ from, to, data, value }, 'latest']);

  // For ETH value transfers, balance diff = -value - gasCost
  // For contract calls, need to check token balances too
  const valueBigInt = BigInt(value || '0x0');
  const ethAfter = ethBefore - valueBigInt; // simplified; gas estimation adds precision

  return { ethBefore, ethAfter };
}
```

### Connected Sites Storage
```typescript
// Source: chrome.storage.local patterns from existing codebase
interface ConnectedSite {
  origin: string;
  favicon: string;
  name: string;
  accounts: string[]; // checksummed addresses
  connectedAt: number;
}

async function getConnectedSites(): Promise<ConnectedSite[]> {
  const result = await chrome.storage.local.get('connectedSites');
  return Array.isArray(result.connectedSites) ? result.connectedSites : [];
}

async function addConnectedSite(site: ConnectedSite): Promise<void> {
  const sites = await getConnectedSites();
  const filtered = sites.filter(s => s.origin !== site.origin);
  await chrome.storage.local.set({ connectedSites: [...filtered, site] });
}

async function removeConnectedSite(origin: string): Promise<void> {
  const sites = await getConnectedSites();
  await chrome.storage.local.set({
    connectedSites: sites.filter(s => s.origin !== origin),
  });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| window.ethereum injection (conflicting) | EIP-6963 multi-wallet discovery | 2023 (finalized) | Wallets coexist without overriding each other |
| eth_sign (dangerous) | personal_sign + eth_signTypedData_v4 | 2023 (MetaMask disabled eth_sign) | eth_sign blocked by default in modern wallets |
| Manifest V2 persistent background | MV3 service worker (can suspend) | 2022-2023 | Must persist pending requests; can't rely on in-memory state alone |
| Blind signing of typed data | Structured EIP-712 display with Permit warnings | 2023-2024 | Wallets must detect and warn on Permit signatures |

**Deprecated/outdated:**
- `eth_sign`: Disabled by MetaMask, dangerous phishing vector. DAPP-09 requires blocking by default.
- `window.ethereum` as sole discovery: EIP-6963 replaces it, but backward compat still needed.

## Open Questions

1. **Popup URL routing for approval screens**
   - What we know: Current App.tsx uses zustand store screen state, not URL-based routing
   - What's unclear: Best way to route popup.html to dapp approval screens when opened via chrome.windows.create
   - Recommendation: Use chrome.storage.session to store pending request; popup.tsx checks for pending request on init and shows approval screen instead of main wallet. This avoids URL fragment complexity.

2. **Service worker suspension during approval flow**
   - What we know: MV3 workers can suspend; approval may take seconds to minutes
   - What's unclear: Whether chrome.windows.onRemoved listener survives suspension
   - Recommendation: Store all pending request state in chrome.storage.session. Content script uses chrome.runtime.sendMessage for response (which wakes the worker). Don't rely on in-memory Maps surviving.

3. **Simulation accuracy for complex contract interactions**
   - What we know: eth_call simulates at current block state; balances can be fetched before/after
   - What's unclear: How to detect ERC20 balance changes from arbitrary contract calls (need to call balanceOf before and after)
   - Recommendation: Start with ETH value diff only. For known ERC20 methods (transfer, approve), add token balance diff. Complex DeFi interactions show "unable to simulate" rather than wrong data.

## Sources

### Primary (HIGH confidence)
- micro-eth-signer v0.18.1 package inspection -- verified eip191Signer, signTyped, decodeData exports
- EIP-1193 specification (https://eips.ethereum.org/EIPS/eip-1193) -- Provider interface, error codes, events
- EIP-6963 specification (https://eips.ethereum.org/EIPS/eip-6963) -- ProviderInfo, ProviderDetail, event flow
- Existing codebase analysis -- content.ts, inpage.ts, background.ts, types.ts, build.ts

### Secondary (MEDIUM confidence)
- MetaMask signing docs (https://docs.metamask.io/wallet/how-to/sign-data/) -- personal_sign, signTypedData_v4 parameter formats
- MetaMask eth_sign security info (https://support.metamask.io/more-web3/learn/what-is-eth_sign-and-why-is-it-a-risk/) -- justification for blocking eth_sign
- EIP-2612 (https://eips.ethereum.org/EIPS/eip-2612) -- Permit signature structure
- Chrome windows API (https://developer.chrome.com/docs/extensions/reference/api/windows) -- chrome.windows.create parameters

### Tertiary (LOW confidence)
- Balance diff simulation pattern -- derived from eth_call behavior, not verified with specific wallet implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - micro-eth-signer already installed and verified, no new deps needed
- Architecture: HIGH - three-layer pattern is industry standard, existing codebase already has the scaffolding
- Pitfalls: HIGH - well-documented by MetaMask, Rabby, and other wallet implementations

**Research date:** 2026-03-01
**Valid until:** 2026-03-31 (stable domain, EIP specs don't change)
