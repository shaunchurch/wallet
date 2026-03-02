import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import { getConnectedSite } from '@/features/dapp/connections';
import { getMethodCategory } from '@/features/dapp/rpc-whitelist';
import type { DappRpcRequest, DappRpcResponse } from '@/features/dapp/types';
import {
  createLockoutManager,
  decryptVault,
  deriveAccount,
  encryptVault,
  generateMnemonic,
  isValidMnemonic,
  mnemonicToSeed,
} from '@/features/wallet/crypto';
import { getEthPrice } from '@/features/wallet/price';
import {
  estimateGas,
  getExplorerTxUrl,
  getFeeParams,
  NETWORKS,
  rpcCall,
} from '@/features/wallet/rpc';
import { buildAndSignTransaction, formatEth } from '@/features/wallet/tx';
import type {
  DerivedAccount,
  LockoutManager,
  LockoutState,
  RecentAddress,
  VaultBlob,
  VaultPlaintext,
  WalletMessage,
  WalletResponse,
} from '@/features/wallet/types';

// ---------------------------------------------------------------------------
// Auto-lock alarm constants (SEC-08)
// ---------------------------------------------------------------------------

const AUTO_LOCK_ALARM = 'auto-lock';
const DEFAULT_AUTO_LOCK_MINUTES = 15;
const VALID_AUTO_LOCK_VALUES = [5, 15, 30, 60];

// ---------------------------------------------------------------------------
// Auto-lock alarm listener (top-level -- survives SW restart)
// ---------------------------------------------------------------------------

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === AUTO_LOCK_ALARM) {
    await clearSession();
    await removePendingCreation();
  }
});

// ---------------------------------------------------------------------------
// Auto-lock alarm helpers
// ---------------------------------------------------------------------------

async function resetAutoLockAlarm(): Promise<void> {
  const result = await chrome.storage.local.get('autoLockMinutes');
  const minutes =
    (typeof result.autoLockMinutes === 'number' && result.autoLockMinutes) ||
    DEFAULT_AUTO_LOCK_MINUTES;
  await chrome.alarms.clear(AUTO_LOCK_ALARM);
  await chrome.alarms.create(AUTO_LOCK_ALARM, { delayInMinutes: minutes });
}

async function clearAutoLockAlarm(): Promise<void> {
  await chrome.alarms.clear(AUTO_LOCK_ALARM);
}

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
// Derived indices persistence (survives lock/unlock cycles)
// ---------------------------------------------------------------------------

async function loadDerivedIndices(): Promise<number[]> {
  const result = await chrome.storage.local.get('derivedIndices');
  return Array.isArray(result.derivedIndices) ? (result.derivedIndices as number[]) : [0];
}

async function saveDerivedIndices(indices: number[]): Promise<void> {
  await chrome.storage.local.set({ derivedIndices: indices });
}

async function clearDerivedIndices(): Promise<void> {
  await chrome.storage.local.remove('derivedIndices');
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
// Ready promise -- gates message handling until init completes
// ---------------------------------------------------------------------------

const ready: Promise<void> = (async () => {
  await restoreLockout();
  // Re-register auto-lock alarm if session exists (handles browser restart)
  const session = await getSession();
  if (session) {
    const alarm = await chrome.alarms.get(AUTO_LOCK_ALARM);
    if (!alarm) {
      await resetAutoLockAlarm();
    }
  }
})();

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

export async function handleWalletMessage(msg: WalletMessage): Promise<WalletResponse> {
  try {
    await ready;

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
      case 'wallet:getLockoutStatus':
        return handleGetLockoutStatus();
      case 'wallet:deriveAccount':
        return await handleDeriveAccount(msg.index);
      case 'wallet:exportSeedPhrase':
        return await handleExportSeedPhrase(msg.password);
      case 'wallet:setAutoLockTimeout':
        return await handleSetAutoLockTimeout(msg.minutes);
      case 'wallet:getAutoLockTimeout':
        return await handleGetAutoLockTimeout();
      case 'wallet:heartbeat':
        return await handleHeartbeat();
      case 'wallet:getBalance':
        return await handleGetBalance(msg.accountIndex);
      case 'wallet:estimateGas':
        return await handleEstimateGas(msg.to, msg.value, msg.accountIndex);
      case 'wallet:getFeeParams':
        return await handleGetFeeParams();
      case 'wallet:getEthPrice':
        return await handleGetEthPrice();
      case 'wallet:sendTransaction':
        return await handleSendTransaction(msg.to, msg.value, msg.accountIndex);
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

  // Clear stale derived indices from any previous wallet
  await clearDerivedIndices();

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
  await resetAutoLockAlarm();

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

  // Clear stale derived indices from any previous wallet
  await clearDerivedIndices();
  await resetAutoLockAlarm();

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

  // Restore all previously-derived accounts
  const indices = await loadDerivedIndices();
  const accounts: DerivedAccount[] = [];
  for (const idx of indices) {
    const kp = deriveAccount(seed, idx);
    accounts.push(toDerivedAccount(kp, idx));
  }

  // Ensure at least index 0
  if (accounts.length === 0) {
    const kp = deriveAccount(seed, 0);
    accounts.push(toDerivedAccount(kp, 0));
  }

  await cacheSession({ seed: bytesToHex(seed), accounts });
  await resetAutoLockAlarm();
  return { type: 'wallet:unlocked', address: accounts[0]?.address as string };
}

async function handleLock(): Promise<WalletResponse> {
  await clearSession();
  await removePendingCreation();
  await clearAutoLockAlarm();
  return { type: 'wallet:locked' };
}

async function handleGetAccounts(): Promise<WalletResponse> {
  const session = await getSession();
  if (!session) {
    return { type: 'wallet:error', error: 'Wallet is locked' };
  }
  return { type: 'wallet:accounts', accounts: session.accounts };
}

function handleGetLockoutStatus(): WalletResponse {
  const { locked, remainingMs } = lockout.checkLockout();
  const state = lockout.serialize();
  return {
    type: 'wallet:lockoutStatus',
    locked,
    remainingMs,
    failedAttempts: state.failedAttempts,
  };
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

  // Persist derived index for restore on unlock
  const indices = await loadDerivedIndices();
  if (!indices.includes(index)) {
    indices.push(index);
    await saveDerivedIndices(indices);
  }

  return { type: 'wallet:derived', account };
}

// ---------------------------------------------------------------------------
// SEC-09: Seed phrase export (password-gated)
// ---------------------------------------------------------------------------

async function handleExportSeedPhrase(password: string): Promise<WalletResponse> {
  const session = await getSession();
  if (!session) {
    return { type: 'wallet:error', error: 'Wallet is locked' };
  }

  const vault = await loadVault();
  if (!vault) {
    return { type: 'wallet:error', error: 'No vault found' };
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
  return { type: 'wallet:seedPhrase', mnemonic: plaintext.mnemonic };
}

// ---------------------------------------------------------------------------
// SET-02: Auto-lock timeout configuration
// ---------------------------------------------------------------------------

async function handleSetAutoLockTimeout(minutes: number): Promise<WalletResponse> {
  if (!VALID_AUTO_LOCK_VALUES.includes(minutes)) {
    return { type: 'wallet:error', error: 'Invalid auto-lock timeout' };
  }

  await chrome.storage.local.set({ autoLockMinutes: minutes });

  // Reset alarm with new timeout if wallet is unlocked
  const session = await getSession();
  if (session) {
    await resetAutoLockAlarm();
  }

  return { type: 'wallet:settingsSaved' };
}

async function handleGetAutoLockTimeout(): Promise<WalletResponse> {
  const result = await chrome.storage.local.get('autoLockMinutes');
  const minutes =
    typeof result.autoLockMinutes === 'number' ? result.autoLockMinutes : DEFAULT_AUTO_LOCK_MINUTES;
  return { type: 'wallet:autoLockTimeout', minutes };
}

// ---------------------------------------------------------------------------
// SEC-08: Heartbeat (resets auto-lock on user interaction)
// ---------------------------------------------------------------------------

async function handleHeartbeat(): Promise<WalletResponse> {
  const session = await getSession();
  if (!session) {
    return { type: 'wallet:error', error: 'Wallet is locked' };
  }
  await resetAutoLockAlarm();
  return { type: 'wallet:heartbeatAck' };
}

// ---------------------------------------------------------------------------
// Network preference helper
// ---------------------------------------------------------------------------

async function getNetworkPreference(): Promise<'mainnet' | 'testnet'> {
  const result = await chrome.storage.local.get('network');
  return result.network === 'testnet' ? 'testnet' : 'mainnet';
}

// ---------------------------------------------------------------------------
// Recent addresses helper (TX-09)
// ---------------------------------------------------------------------------

async function saveRecentAddress(address: string): Promise<void> {
  const result = await chrome.storage.local.get('recentAddresses');
  const existing: RecentAddress[] = Array.isArray(result.recentAddresses)
    ? (result.recentAddresses as RecentAddress[])
    : [];
  const filtered = existing.filter((r) => r.address.toLowerCase() !== address.toLowerCase());
  const updated = [{ address, timestamp: Date.now() }, ...filtered].slice(0, 10);
  await chrome.storage.local.set({ recentAddresses: updated });
}

// ---------------------------------------------------------------------------
// Transaction handlers
// ---------------------------------------------------------------------------

async function handleGetBalance(accountIndex: number): Promise<WalletResponse> {
  const session = await getSession();
  if (!session) return { type: 'wallet:error', error: 'Wallet is locked' };
  const network = await getNetworkPreference();
  const account = session.accounts.find((a) => a.index === accountIndex);
  if (!account) return { type: 'wallet:error', error: 'Account not found' };

  const raw = await rpcCall(network, 'eth_getBalance', [account.address, 'latest']);
  const balanceWei = BigInt(raw as string);
  return {
    type: 'wallet:balance',
    balanceWei: `0x${balanceWei.toString(16)}`,
    balanceEth: formatEth(balanceWei),
  };
}

async function handleEstimateGas(
  to: string,
  valueHex: string,
  accountIndex: number,
): Promise<WalletResponse> {
  const session = await getSession();
  if (!session) return { type: 'wallet:error', error: 'Wallet is locked' };
  const network = await getNetworkPreference();
  const account = session.accounts.find((a) => a.index === accountIndex);
  if (!account) return { type: 'wallet:error', error: 'Account not found' };

  const value = BigInt(valueHex);
  const [gasLimit, feeParams] = await Promise.all([
    estimateGas(network, account.address, to, value),
    getFeeParams(network),
  ]);
  const estimatedFeeWei = gasLimit * feeParams.maxFeePerGas;
  return {
    type: 'wallet:gasEstimate',
    gasLimit: `0x${gasLimit.toString(16)}`,
    maxFeePerGas: `0x${feeParams.maxFeePerGas.toString(16)}`,
    maxPriorityFeePerGas: `0x${feeParams.priorityFee.toString(16)}`,
    estimatedFeeWei: `0x${estimatedFeeWei.toString(16)}`,
    estimatedFeeEth: formatEth(estimatedFeeWei),
  };
}

async function handleGetFeeParams(): Promise<WalletResponse> {
  const network = await getNetworkPreference();
  const params = await getFeeParams(network);
  return {
    type: 'wallet:feeParams',
    baseFee: `0x${params.baseFee.toString(16)}`,
    priorityFee: `0x${params.priorityFee.toString(16)}`,
    maxFeePerGas: `0x${params.maxFeePerGas.toString(16)}`,
  };
}

async function handleGetEthPrice(): Promise<WalletResponse> {
  const usd = await getEthPrice();
  return { type: 'wallet:ethPrice', usd };
}

async function handleSendTransaction(
  to: string,
  valueHex: string,
  accountIndex: number,
): Promise<WalletResponse> {
  const session = await getSession();
  if (!session) return { type: 'wallet:error', error: 'Wallet is locked' };
  const network = await getNetworkPreference();

  // Derive full key pair (private key stays in this function scope)
  const seed = hexToBytes(session.seed);
  const kp = deriveAccount(seed, accountIndex);
  const value = BigInt(valueHex);

  try {
    // Fetch nonce, fee params, gas estimate in parallel
    const [nonceRaw, feeParams, gasLimit] = await Promise.all([
      rpcCall(network, 'eth_getTransactionCount', [kp.address, 'pending']),
      getFeeParams(network),
      estimateGas(network, kp.address, to, value),
    ]);
    const nonce = BigInt(nonceRaw as string);

    const { chainId } = NETWORKS[network];
    const signedTx = buildAndSignTransaction({
      to,
      value,
      nonce,
      gasLimit,
      maxFeePerGas: feeParams.maxFeePerGas,
      maxPriorityFeePerGas: feeParams.priorityFee,
      chainId,
      privateKey: kp.privateKey,
    });

    // TX-07: Try realtime_sendRawTransaction first
    let txHash: string;
    try {
      const receipt = await Promise.race([
        rpcCall(network, 'realtime_sendRawTransaction', [signedTx]) as Promise<{
          transactionHash: string;
        }>,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('realtime_timeout')), 10_000),
        ),
      ]);
      txHash = (receipt as { transactionHash: string }).transactionHash;
    } catch {
      // TX-08: Fallback to standard send + poll
      txHash = (await rpcCall(network, 'eth_sendRawTransaction', [signedTx])) as string;

      // Poll for receipt (up to 10s, every 500ms)
      for (let i = 0; i < 20; i++) {
        const receipt = await rpcCall(network, 'eth_getTransactionReceipt', [txHash]);
        if (receipt) break;
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    // TX-09: Save recent address after success
    await saveRecentAddress(to);
    const explorerUrl = getExplorerTxUrl(network, txHash);
    return { type: 'wallet:txResult', success: true, txHash, explorerUrl };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Transaction failed';
    return { type: 'wallet:txResult', success: false, txHash: '', explorerUrl: '', error };
  }
}

// ---------------------------------------------------------------------------
// Dapp RPC handler (DAPP-07 through DAPP-10)
// ---------------------------------------------------------------------------

async function handleDappRpc(msg: DappRpcRequest): Promise<DappRpcResponse> {
  const category = getMethodCategory(msg.method);

  // Unknown method
  if (!category) {
    return { error: { code: 4200, message: `Unsupported method: ${msg.method}` } };
  }

  // Blocked methods (DAPP-09: eth_sign blocked unless user enabled)
  if (category === 'blocked') {
    const { ethSignEnabled } = await chrome.storage.local.get('ethSignEnabled');
    if (!ethSignEnabled) {
      return {
        error: {
          code: 4200,
          message:
            'eth_sign is disabled for security. Use personal_sign instead. Enable in Advanced Settings if required.',
        },
      };
    }
    // eth_sign enabled -- treat as approval (falls through)
  }

  // Direct methods -- handle locally or proxy to RPC
  if (category === 'direct') {
    return handleDirectRpc(msg);
  }

  // Approval methods -- will be implemented in plan 05-02
  return {
    error: { code: 4200, message: `Method ${msg.method} requires approval (not yet implemented)` },
  };
}

async function handleDirectRpc(msg: DappRpcRequest): Promise<DappRpcResponse> {
  const network = await getNetworkPreference();

  switch (msg.method) {
    case 'eth_chainId': {
      const { chainId } = NETWORKS[network];
      return { result: `0x${chainId.toString(16)}` };
    }
    case 'eth_accounts': {
      // Return connected accounts for this origin, or empty array if not connected
      const site = await getConnectedSite(msg.origin);
      return { result: site?.accounts ?? [] };
    }
    case 'net_version': {
      const { chainId } = NETWORKS[network];
      return { result: String(chainId) };
    }
    case 'web3_clientVersion': {
      return { result: 'megawallet/0.1.0' };
    }
    case 'wallet_switchEthereumChain': {
      // DAPP-08: accept megaETH chains only
      const params = msg.params as [{ chainId: string }] | undefined;
      const requestedChainId = params?.[0]?.chainId;
      if (!requestedChainId) {
        return { error: { code: -32602, message: 'Missing chainId parameter' } };
      }
      const requested = Number(requestedChainId);
      const mainnetId = NETWORKS.mainnet.chainId;
      const testnetId = NETWORKS.testnet.chainId;
      if (requested === mainnetId) {
        await chrome.storage.local.set({ network: 'mainnet' });
        return { result: null };
      }
      if (requested === testnetId) {
        await chrome.storage.local.set({ network: 'testnet' });
        return { result: null };
      }
      return {
        error: {
          code: 4902,
          message: `megawallet only supports megaETH mainnet (${mainnetId}) and testnet (${testnetId}). Add the chain to a multi-chain wallet like MetaMask.`,
        },
      };
    }
    default: {
      // Proxy all other direct methods to megaETH RPC
      try {
        const result = await rpcCall(network, msg.method, msg.params ?? []);
        return { result };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'RPC call failed';
        return { error: { code: -32603, message } };
      }
    }
  }
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
// Dapp RPC listener (separate from wallet listener)
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Dapp messages come from content scripts -- same extension ID, but web origin
  if (sender.id !== chrome.runtime.id) return;
  if (msg.type !== 'dapp:rpc') return;

  handleDappRpc(msg as DappRpcRequest).then(sendResponse);
  return true; // async response
});

// ---------------------------------------------------------------------------
// Service worker initialization
// ---------------------------------------------------------------------------

console.log('[megawallet] background service worker started');

chrome.runtime.onInstalled.addListener(() => {
  console.log('[megawallet] extension installed');
});
