// Inpage script -- injected into page MAIN world (IIFE, no chrome.runtime access)
// EIP-1193 provider + EIP-6963 announcement
export {}; // TS module isolation (builds as IIFE)

const CHANNEL = 'megawallet-provider';

// ---------------------------------------------------------------------------
// MegaWalletProvider (EIP-1193)
// ---------------------------------------------------------------------------

class MegaWalletProvider {
  readonly isMetaMask = false;

  private _listeners = new Map<string, Set<(...args: unknown[]) => void>>();
  private _requestId = 0;
  private _pendingRequests = new Map<
    number,
    { resolve: (r: unknown) => void; reject: (e: Error) => void }
  >();

  async request({ method, params }: { method: string; params?: unknown[] }): Promise<unknown> {
    const id = ++this._requestId;
    return new Promise<unknown>((resolve, reject) => {
      this._pendingRequests.set(id, { resolve, reject });
      window.postMessage({ channel: CHANNEL, direction: 'to-background', id, method, params }, '*');
    });
  }

  on(event: string, listener: (...args: unknown[]) => void): void {
    let set = this._listeners.get(event);
    if (!set) {
      set = new Set();
      this._listeners.set(event, set);
    }
    set.add(listener);
  }

  removeListener(event: string, listener: (...args: unknown[]) => void): void {
    this._listeners.get(event)?.delete(listener);
  }

  /** @internal -- called by message listener */
  _emit(event: string, ...args: unknown[]): void {
    const set = this._listeners.get(event);
    if (!set) return;
    for (const fn of set) {
      try {
        fn(...args);
      } catch {
        // listener errors must not break the provider
      }
    }
  }

  /** @internal -- called by message listener */
  _handleResponse(id: number, result: unknown, error?: { code: number; message: string }): void {
    const pending = this._pendingRequests.get(id);
    if (!pending) return;
    this._pendingRequests.delete(id);
    if (error) {
      const err = Object.assign(new Error(error.message), { code: error.code });
      pending.reject(err);
    } else {
      pending.resolve(result);
    }
  }
}

// ---------------------------------------------------------------------------
// Create frozen instance (DAPP-11: no mutable state exposed)
// ---------------------------------------------------------------------------

const provider = Object.freeze(new MegaWalletProvider());

// ---------------------------------------------------------------------------
// Response listener (content script -> inpage)
// ---------------------------------------------------------------------------

window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (event.data?.channel !== CHANNEL) return;
  if (event.data?.direction !== 'to-page') return;

  // Event-type messages (accountsChanged, chainChanged, etc.)
  if (event.data.event) {
    provider._emit(event.data.event, event.data.data);
    return;
  }

  // RPC response
  provider._handleResponse(event.data.id, event.data.result, event.data.error);
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
  name: 'megawallet',
  icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="%2318181b"/><text x="16" y="22" text-anchor="middle" fill="white" font-size="18" font-family="monospace">M</text></svg>',
  rdns: 'com.megawallet',
};

const detail = Object.freeze({ info: Object.freeze(providerInfo), provider });

// Announce on load
window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail }));

// Re-announce when dapps request discovery
window.addEventListener('eip6963:requestProvider', () => {
  window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail }));
});
