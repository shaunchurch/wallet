import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import {
  createLockoutManager,
  decryptVault,
  deriveAccount,
  encryptVault,
  generateMnemonic,
  isValidMnemonic,
  mnemonicToSeed,
} from '@/features/wallet/crypto';
import type {
  DerivedAccount,
  LockoutManager,
  LockoutState,
  VaultBlob,
  VaultPlaintext,
  WalletMessage,
  WalletResponse,
} from '@/features/wallet/types';

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

interface WalletSession {
  seed: string; // hex-encoded
  accounts: DerivedAccount[];
}

interface PendingCreation {
  vault: VaultBlob;
  seed: string; // hex-encoded
  mnemonic: string;
  accounts: DerivedAccount[];
}

async function saveVault(blob: VaultBlob): Promise<void> {
  await chrome.storage.local.set({ vault: blob });
}

async function loadVault(): Promise<VaultBlob | null> {
  const result = await chrome.storage.local.get('vault');
  return (result.vault as VaultBlob) ?? null;
}

async function cacheSession(data: WalletSession): Promise<void> {
  await chrome.storage.session.set({ walletSession: data });
}

async function getSession(): Promise<WalletSession | null> {
  const result = await chrome.storage.session.get('walletSession');
  return (result.walletSession as WalletSession) ?? null;
}

async function clearSession(): Promise<void> {
  await chrome.storage.session.remove('walletSession');
}

async function savePendingCreation(data: PendingCreation): Promise<void> {
  await chrome.storage.session.set({ pendingCreation: data });
}

async function getPendingCreation(): Promise<PendingCreation | null> {
  const result = await chrome.storage.session.get('pendingCreation');
  return (result.pendingCreation as PendingCreation) ?? null;
}

async function removePendingCreation(): Promise<void> {
  await chrome.storage.session.remove('pendingCreation');
}

// ---------------------------------------------------------------------------
// Lockout manager (survives SW restarts via storage.session)
// ---------------------------------------------------------------------------

let lockout: LockoutManager = createLockoutManager();

async function persistLockout(): Promise<void> {
  await chrome.storage.session.set({ lockoutState: lockout.serialize() });
}

async function restoreLockout(): Promise<void> {
  const result = await chrome.storage.session.get('lockoutState');
  if (result.lockoutState) {
    lockout = createLockoutManager(result.lockoutState as LockoutState);
  }
}

// ---------------------------------------------------------------------------
// Key-pair -> DerivedAccount (strips private key)
// ---------------------------------------------------------------------------

function toDerivedAccount(
  kp: {
    address: string;
    path: string;
    privateKey: Uint8Array;
  },
  index: number,
): DerivedAccount {
  return { index, address: kp.address, path: kp.path };
}

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

export async function handleWalletMessage(msg: WalletMessage): Promise<WalletResponse> {
  try {
    switch (msg.type) {
      case 'wallet:create':
        return await handleCreate(msg.password, msg.strength);
      case 'wallet:confirmSeedPhrase':
        return await handleConfirmSeedPhrase(msg.wordIndices);
      case 'wallet:import':
        return await handleImport(msg.password, msg.mnemonic);
      case 'wallet:unlock':
        return await handleUnlock(msg.password);
      case 'wallet:lock':
        return await handleLock();
      case 'wallet:getAccounts':
        return await handleGetAccounts();
      case 'wallet:deriveAccount':
        return await handleDeriveAccount(msg.index);
      default:
        return { type: 'wallet:error', error: 'Unknown message type' };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { type: 'wallet:error', error: message };
  }
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function handleCreate(password: string, strength?: 128 | 256): Promise<WalletResponse> {
  const mnemonic = generateMnemonic(strength ?? 128);
  const seed = await mnemonicToSeed(mnemonic);
  const kp = deriveAccount(seed, 0);
  const account = toDerivedAccount(kp, 0);

  const plaintext: VaultPlaintext = { mnemonic, createdAt: Date.now() };
  const vault = await encryptVault(plaintext, password);

  // SEC-03: Save to session only (pending), NOT storage.local
  await savePendingCreation({
    vault,
    seed: bytesToHex(seed),
    mnemonic,
    accounts: [account],
  });

  return { type: 'wallet:created', address: account.address, mnemonic };
}

async function handleConfirmSeedPhrase(
  wordIndices: Array<{ position: number; word: string }>,
): Promise<WalletResponse> {
  // SEC-03: require at least 3 word challenges to prevent empty-payload bypass
  if (!Array.isArray(wordIndices) || wordIndices.length < 3) {
    return { type: 'wallet:error', error: 'Must confirm at least 3 words' };
  }

  const pending = await getPendingCreation();
  if (!pending) {
    return { type: 'wallet:error', error: 'No pending wallet creation' };
  }

  // Validate each challenged word position
  const words = pending.mnemonic.split(' ');
  for (const challenge of wordIndices) {
    if (words[challenge.position] !== challenge.word) {
      return { type: 'wallet:error', error: 'Seed phrase confirmation failed' };
    }
  }

  // SEC-03: NOW persist vault to storage.local
  await saveVault(pending.vault);
  await cacheSession({ seed: pending.seed, accounts: pending.accounts });
  await removePendingCreation();

  const address = pending.accounts[0]?.address as string;
  return { type: 'wallet:confirmed', address };
}

async function handleImport(password: string, mnemonic: string): Promise<WalletResponse> {
  if (!isValidMnemonic(mnemonic)) {
    return { type: 'wallet:error', error: 'Invalid mnemonic' };
  }

  const seed = await mnemonicToSeed(mnemonic);
  const kp = deriveAccount(seed, 0);
  const account = toDerivedAccount(kp, 0);

  const plaintext: VaultPlaintext = { mnemonic, createdAt: Date.now() };
  const vault = await encryptVault(plaintext, password);

  await saveVault(vault);
  await cacheSession({ seed: bytesToHex(seed), accounts: [account] });

  return { type: 'wallet:imported', address: account.address };
}

async function handleUnlock(password: string): Promise<WalletResponse> {
  const { locked, remainingMs } = lockout.checkLockout();
  if (locked) {
    return {
      type: 'wallet:error',
      error: `Too many attempts. Try again in ${Math.ceil(remainingMs / 1000)}s`,
    };
  }

  const vault = await loadVault();
  if (!vault) {
    return { type: 'wallet:error', error: 'No wallet found' };
  }

  let plaintext: VaultPlaintext;
  try {
    plaintext = await decryptVault(vault, password);
  } catch {
    lockout.recordFailure();
    await persistLockout();
    return { type: 'wallet:error', error: 'Incorrect password' };
  }

  lockout.reset();
  await persistLockout();

  const seed = await mnemonicToSeed(plaintext.mnemonic);
  const kp = deriveAccount(seed, 0);
  const account = toDerivedAccount(kp, 0);

  await cacheSession({ seed: bytesToHex(seed), accounts: [account] });
  return { type: 'wallet:unlocked', address: account.address };
}

async function handleLock(): Promise<WalletResponse> {
  await clearSession();
  await removePendingCreation();
  return { type: 'wallet:locked' };
}

async function handleGetAccounts(): Promise<WalletResponse> {
  const session = await getSession();
  if (!session) {
    return { type: 'wallet:error', error: 'Wallet is locked' };
  }
  return { type: 'wallet:accounts', accounts: session.accounts };
}

async function handleDeriveAccount(index: number): Promise<WalletResponse> {
  if (!Number.isSafeInteger(index) || index < 0) {
    return { type: 'wallet:error', error: 'Invalid account index' };
  }

  const session = await getSession();
  if (!session) {
    return { type: 'wallet:error', error: 'Wallet is locked' };
  }

  const seed = hexToBytes(session.seed);
  const kp = deriveAccount(seed, index);
  const account = toDerivedAccount(kp, index);

  // Add to session if not already present
  const exists = session.accounts.some((a) => a.index === index);
  if (!exists) {
    session.accounts.push(account);
    await cacheSession(session);
  }

  return { type: 'wallet:derived', account };
}

// ---------------------------------------------------------------------------
// Listener registration
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Only accept messages from our own extension contexts
  if (sender.id !== chrome.runtime.id) return;
  // Reject content script / inpage origins
  if (sender.origin && !sender.origin.startsWith('chrome-extension://')) return;

  if (msg.type?.startsWith('wallet:')) {
    handleWalletMessage(msg as WalletMessage).then(sendResponse);
    return true; // async response
  }
});

// ---------------------------------------------------------------------------
// Service worker initialization
// ---------------------------------------------------------------------------

console.log('[megawallet] background service worker started');

chrome.runtime.onInstalled.addListener(() => {
  console.log('[megawallet] extension installed');
});

// Restore lockout state from session (survives SW suspension)
restoreLockout();
