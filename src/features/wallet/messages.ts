// Type-safe message wrapper for popup -> background communication.
// CRITICAL: This file imports ONLY types. Zero crypto code. Safe for popup bundle.
import type { WalletMessage, WalletResponse } from './types';

/**
 * Send a typed wallet message to the background service worker.
 * Returns the typed response or throws on chrome.runtime errors.
 */
export async function sendWalletMessage(msg: WalletMessage): Promise<WalletResponse> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(msg, (response: WalletResponse) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(response);
    });
  });
}
