// Inpage script -- injected into page MAIN world (IIFE, no chrome.runtime access)
// EIP-1193 provider + EIP-6963 announcement
export {}; // TS module isolation (builds as IIFE)

const CHANNEL = 'vibewallet-provider';

// ---------------------------------------------------------------------------
// VibeWalletProvider (EIP-1193)
// Mutable state lives in closures so Object.freeze() doesn't block mutations.
// ---------------------------------------------------------------------------

const _listeners = new Map<string, Set<(...args: unknown[]) => void>>();
let _requestId = 0;
const _pendingRequests = new Map<
  number,
  { resolve: (r: unknown) => void; reject: (e: Error) => void }
>();

function _emit(event: string, ...args: unknown[]): void {
  const set = _listeners.get(event);
  if (!set) return;
  for (const fn of set) {
    try {
      fn(...args);
    } catch {
      // listener errors must not break the provider
    }
  }
}

function _handleResponse(
  id: number,
  result: unknown,
  error?: { code: number; message: string },
): void {
  const pending = _pendingRequests.get(id);
  if (!pending) return;
  _pendingRequests.delete(id);
  if (error) {
    const err = Object.assign(new Error(error.message), { code: error.code });
    pending.reject(err);
  } else {
    pending.resolve(result);
  }
}

const vibeWalletProvider = {
  isMetaMask: false as const,

  async request({ method, params }: { method: string; params?: unknown[] }): Promise<unknown> {
    const id = ++_requestId;
    return new Promise<unknown>((resolve, reject) => {
      _pendingRequests.set(id, { resolve, reject });
      window.postMessage({ channel: CHANNEL, direction: 'to-background', id, method, params }, '*');
    });
  },

  on(event: string, listener: (...args: unknown[]) => void): void {
    let set = _listeners.get(event);
    if (!set) {
      set = new Set();
      _listeners.set(event, set);
    }
    set.add(listener);
  },

  removeListener(event: string, listener: (...args: unknown[]) => void): void {
    _listeners.get(event)?.delete(listener);
  },
};

// ---------------------------------------------------------------------------
// Create frozen instance (DAPP-11: no mutable state exposed)
// ---------------------------------------------------------------------------

const provider = Object.freeze(vibeWalletProvider);

// ---------------------------------------------------------------------------
// Response listener (content script -> inpage)
// ---------------------------------------------------------------------------

window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (event.data?.channel !== CHANNEL) return;
  if (event.data?.direction !== 'to-page') return;

  // Event-type messages (accountsChanged, chainChanged, etc.)
  if (event.data.event) {
    _emit(event.data.event, event.data.data);
    return;
  }

  // RPC response
  _handleResponse(event.data.id, event.data.result, event.data.error);
});

// ---------------------------------------------------------------------------
// Set window.ethereum for backward compatibility
// ---------------------------------------------------------------------------

try {
  Object.defineProperty(window, 'ethereum', {
    value: provider,
    writable: false,
    configurable: true, // allow other wallets to also set
  });
} catch {
  /* another wallet may have set it non-configurable */
}

// ---------------------------------------------------------------------------
// EIP-6963 announcement (DAPP-02)
// ---------------------------------------------------------------------------

const providerInfo = {
  uuid: crypto.randomUUID(),
  name: 'vibewallet',
  icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="%2318181b"/><text x="16" y="22" text-anchor="middle" fill="white" font-size="18" font-family="monospace">V</text></svg>',
  rdns: 'com.vibewallet',
};

const detail = Object.freeze({ info: Object.freeze(providerInfo), provider });

// Announce on load
window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail }));

// Re-announce when dapps request discovery
window.addEventListener('eip6963:requestProvider', () => {
  window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail }));
});
