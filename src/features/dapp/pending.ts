// Pending dapp request queue with chrome.storage.session persistence
// Survives service worker suspension; in-memory callbacks do not.

export interface PendingDappRequest {
  id: string; // unique request ID (crypto.randomUUID())
  rpcId: number; // original RPC request ID from inpage
  method: string; // eth_requestAccounts, eth_sendTransaction, etc.
  params?: unknown[];
  origin: string;
  favicon?: string;
  title?: string;
  tabId?: number; // originating tab for SW-restart fallback
  createdAt: number;
}

// ---------------------------------------------------------------------------
// Chrome.storage.session persistence (survives SW suspension)
// ---------------------------------------------------------------------------

export async function storePendingRequest(req: PendingDappRequest): Promise<void> {
  const existing = await getPendingRequests();
  existing.push(req);
  await chrome.storage.session.set({ pendingDappRequests: existing });
}

export async function getPendingRequests(): Promise<PendingDappRequest[]> {
  const result = await chrome.storage.session.get('pendingDappRequests');
  return Array.isArray(result.pendingDappRequests) ? result.pendingDappRequests : [];
}

export async function getLatestPendingRequest(): Promise<PendingDappRequest | null> {
  const reqs = await getPendingRequests();
  return reqs[reqs.length - 1] ?? null;
}

export async function removePendingRequest(id: string): Promise<PendingDappRequest | null> {
  const reqs = await getPendingRequests();
  const idx = reqs.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  const removed = reqs.splice(idx, 1)[0];
  await chrome.storage.session.set({ pendingDappRequests: reqs });
  return removed ?? null;
}

export async function clearPendingRequests(): Promise<void> {
  await chrome.storage.session.remove('pendingDappRequests');
}

// ---------------------------------------------------------------------------
// In-memory callback map (per service worker lifetime)
// ---------------------------------------------------------------------------

const callbacks = new Map<
  string,
  {
    resolve: (result: unknown) => void;
    reject: (error: { code: number; message: string }) => void;
  }
>();

export function registerCallback(
  id: string,
  resolve: (result: unknown) => void,
  reject: (error: { code: number; message: string }) => void,
): void {
  callbacks.set(id, { resolve, reject });
}

export function resolveRequest(id: string, result: unknown): boolean {
  const cb = callbacks.get(id);
  if (!cb) return false;
  callbacks.delete(id);
  cb.resolve(result);
  return true;
}

export function rejectRequest(id: string, error: { code: number; message: string }): boolean {
  const cb = callbacks.get(id);
  if (!cb) return false;
  callbacks.delete(id);
  cb.reject(error);
  return true;
}
