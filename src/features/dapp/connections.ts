// Connected sites CRUD -- persists in chrome.storage.local
// All operations: read, modify, write back atomically to 'connectedSites' key

import type { ConnectedSite } from './types';

const STORAGE_KEY = 'connectedSites';

export async function getConnectedSites(): Promise<ConnectedSite[]> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return Array.isArray(result[STORAGE_KEY]) ? (result[STORAGE_KEY] as ConnectedSite[]) : [];
}

export async function getConnectedSite(origin: string): Promise<ConnectedSite | null> {
  const sites = await getConnectedSites();
  return sites.find((s) => s.origin === origin) ?? null;
}

/** Upsert by origin -- replaces existing entry if present. */
export async function addConnectedSite(site: ConnectedSite): Promise<void> {
  const sites = await getConnectedSites();
  const filtered = sites.filter((s) => s.origin !== site.origin);
  filtered.push(site);
  await chrome.storage.local.set({ [STORAGE_KEY]: filtered });
}

export async function removeConnectedSite(origin: string): Promise<void> {
  const sites = await getConnectedSites();
  const filtered = sites.filter((s) => s.origin !== origin);
  await chrome.storage.local.set({ [STORAGE_KEY]: filtered });
}

export async function removeAllConnectedSites(): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: [] });
}
