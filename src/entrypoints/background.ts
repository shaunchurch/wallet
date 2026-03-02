import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import { addConnectedSite, getConnectedSite } from '@/features/dapp/connections';
import type { PendingDappRequest } from '@/features/dapp/pending';
import {
  clearPendingRequests,
  getLatestPendingRequest,
  getPendingRequests,
  registerCallback,
  rejectRequest,
  removePendingRequest,
  resolveRequest,
  storePendingRequest,
} from '@/features/dapp/pending';
import { getMethodCategory } from '@/features/dapp/rpc-whitelist';
import type { DappRpcRequest, DappRpcResponse } from '@/features/dapp/types';
import { RPC_ERRORS } from '@/features/dapp/types';
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
      // Dapp popup message handlers
      case 'dapp:approve': {
        // Always remove pending regardless of callback existence
        const pendingReq = await removePendingRequest(msg.requestId);
        const resolved = resolveRequest(msg.requestId, msg.result);
        if (!resolved && pendingReq?.tabId) {
          // SW restarted -- callback lost. Send response to content script via tab.
          chrome.tabs.sendMessage(pendingReq.tabId, {
            type: 'dapp:rpcResponse',
            rpcId: pendingReq.rpcId,
            result: msg.result,
          });
        }
        // If this was eth_requestAccounts, save the connected site
        if (pendingReq?.method === 'eth_requestAccounts') {
          const accounts = Array.isArray(msg.result) ? (msg.result as string[]) : [];
          await addConnectedSite({
            origin: pendingReq.origin,
            favicon: pendingReq.favicon ?? `${pendingReq.origin}/favicon.ico`,
            name: pendingReq.title ?? pendingReq.origin,
            accounts,
            connectedAt: Date.now(),
          });
        }
        return { type: 'dapp:approved' };
      }
      case 'dapp:reject': {
        const pendingReq2 = await removePendingRequest(msg.requestId);
        const rejected = rejectRequest(msg.requestId, RPC_ERRORS.USER_REJECTED);
        if (!rejected && pendingReq2?.tabId) {
          // SW restarted -- callback lost. Send rejection to content script via tab.
          chrome.tabs.sendMessage(pendingReq2.tabId, {
            type: 'dapp:rpcResponse',
            rpcId: pendingReq2.rpcId,
            error: RPC_ERRORS.USER_REJECTED,
          });
        }
        return { type: 'dapp:rejected' };
      }
      case 'dapp:getPendingRequest': {
        const req = await getLatestPendingRequest();
        return { type: 'dapp:pendingRequest', request: req };
      }
      case 'dapp:executeTx':
        return await handleDappExecuteTx(msg.requestId, msg.txParams);
      case 'dapp:signPersonal':
        return await handleDappExecutePersonalSign(msg.requestId, msg.message, msg.account);
      case 'dapp:signTypedData':
        return await handleDappExecuteSignTypedData(msg.requestId, msg.typedData, msg.account);
      case 'dapp:simulate':
        return await handleDappSimulate(msg.txParams);
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

async function handleDappRpc(
  msg: DappRpcRequest,
  senderTabId?: number | undefined,
): Promise<DappRpcResponse> {
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

  // Approval methods -- pending request + popup flow
  if (category === 'approval') {
    return handleApprovalRpc(msg, senderTabId);
  }

  return { error: RPC_ERRORS.UNSUPPORTED };
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
// Approval popup helpers
// ---------------------------------------------------------------------------

let approvalWindowId: number | null = null;

async function openApprovalPopup(): Promise<void> {
  // If there's already an approval popup, focus it
  if (approvalWindowId !== null) {
    try {
      await chrome.windows.update(approvalWindowId, { focused: true });
      return;
    } catch {
      approvalWindowId = null; // window was closed
    }
  }

  const popup = await chrome.windows.create({
    url: chrome.runtime.getURL('popup.html'),
    type: 'popup',
    width: 360,
    height: 620,
    focused: true,
  });

  if (!popup) return;
  approvalWindowId = popup.id ?? null;

  // Listen for window close -> reject all pending requests
  if (popup.id) {
    chrome.windows.onRemoved.addListener(function onClose(windowId) {
      if (windowId !== approvalWindowId) return;
      chrome.windows.onRemoved.removeListener(onClose);
      approvalWindowId = null;
      rejectAllPendingOnClose();
    });
  }
}

async function rejectAllPendingOnClose(): Promise<void> {
  const reqs = await getPendingRequests();
  for (const req of reqs) {
    const rejected = rejectRequest(req.id, RPC_ERRORS.USER_REJECTED);
    if (!rejected && req.tabId) {
      // SW callback lost -- send rejection via tab fallback
      chrome.tabs.sendMessage(req.tabId, {
        type: 'dapp:rpcResponse',
        rpcId: req.rpcId,
        error: RPC_ERRORS.USER_REJECTED,
      });
    }
  }
  await clearPendingRequests();
}

// ---------------------------------------------------------------------------
// Approval method router
// ---------------------------------------------------------------------------

async function handleApprovalRpc(
  msg: DappRpcRequest,
  senderTabId?: number | undefined,
): Promise<DappRpcResponse> {
  // Check wallet is unlocked for all approval methods
  const session = await getSession();
  if (!session) {
    return { error: { code: 4100, message: 'Wallet is locked' } };
  }

  switch (msg.method) {
    case 'eth_requestAccounts':
      return handleDappConnect(msg, senderTabId);
    case 'eth_sendTransaction':
      return handleDappSendTransaction(msg, senderTabId);
    case 'personal_sign':
      return handleDappPersonalSign(msg, senderTabId);
    case 'eth_signTypedData_v4':
      return handleDappSignTypedData(msg, senderTabId);
    default:
      return { error: RPC_ERRORS.UNSUPPORTED };
  }
}

// ---------------------------------------------------------------------------
// eth_requestAccounts handler
// ---------------------------------------------------------------------------

async function handleDappConnect(
  msg: DappRpcRequest,
  senderTabId?: number | undefined,
): Promise<DappRpcResponse> {
  // Check if already connected
  const existing = await getConnectedSite(msg.origin);
  if (existing && existing.accounts.length > 0) {
    return { result: existing.accounts };
  }

  // Need user approval -- create pending request and open popup
  return new Promise((resolve) => {
    const reqId = crypto.randomUUID();
    const pending: PendingDappRequest = {
      id: reqId,
      rpcId: msg.id,
      method: msg.method,
      params: msg.params,
      origin: msg.origin,
      favicon: msg.favicon,
      title: msg.title,
      tabId: senderTabId,
      createdAt: Date.now(),
    };

    registerCallback(
      reqId,
      (result) => resolve({ result }),
      (error) => resolve({ error }),
    );

    storePendingRequest(pending).then(() => openApprovalPopup());
  });
}

// ---------------------------------------------------------------------------
// eth_sendTransaction handler
// ---------------------------------------------------------------------------

async function handleDappSendTransaction(
  msg: DappRpcRequest,
  senderTabId?: number | undefined,
): Promise<DappRpcResponse> {
  const site = await getConnectedSite(msg.origin);
  if (!site) {
    return { error: RPC_ERRORS.UNAUTHORIZED };
  }

  // Verify the 'from' address is in the site's authorized account list
  const txParams = msg.params?.[0] as { from?: string } | undefined;
  if (
    txParams?.from &&
    !site.accounts.some((a) => a.toLowerCase() === (txParams.from as string).toLowerCase())
  ) {
    return { error: { code: 4100, message: 'Account not authorized for this site' } };
  }

  return new Promise((resolve) => {
    const reqId = crypto.randomUUID();
    const pending: PendingDappRequest = {
      id: reqId,
      rpcId: msg.id,
      method: msg.method,
      params: msg.params,
      origin: msg.origin,
      favicon: msg.favicon,
      title: msg.title,
      tabId: senderTabId,
      createdAt: Date.now(),
    };

    registerCallback(
      reqId,
      (result) => resolve({ result }),
      (error) => resolve({ error }),
    );

    storePendingRequest(pending).then(() => openApprovalPopup());
  });
}

// ---------------------------------------------------------------------------
// personal_sign handler
// ---------------------------------------------------------------------------

async function handleDappPersonalSign(
  msg: DappRpcRequest,
  senderTabId?: number | undefined,
): Promise<DappRpcResponse> {
  const site = await getConnectedSite(msg.origin);
  if (!site) {
    return { error: RPC_ERRORS.UNAUTHORIZED };
  }

  // personal_sign params: [message, account] -- verify account is authorized
  const account = msg.params?.[1] as string | undefined;
  if (account && !site.accounts.some((a) => a.toLowerCase() === account.toLowerCase())) {
    return { error: { code: 4100, message: 'Account not authorized for this site' } };
  }

  return new Promise((resolve) => {
    const reqId = crypto.randomUUID();
    const pending: PendingDappRequest = {
      id: reqId,
      rpcId: msg.id,
      method: msg.method,
      params: msg.params,
      origin: msg.origin,
      favicon: msg.favicon,
      title: msg.title,
      tabId: senderTabId,
      createdAt: Date.now(),
    };

    registerCallback(
      reqId,
      (result) => resolve({ result }),
      (error) => resolve({ error }),
    );

    storePendingRequest(pending).then(() => openApprovalPopup());
  });
}

// ---------------------------------------------------------------------------
// eth_signTypedData_v4 handler
// ---------------------------------------------------------------------------

async function handleDappSignTypedData(
  msg: DappRpcRequest,
  senderTabId?: number | undefined,
): Promise<DappRpcResponse> {
  const site = await getConnectedSite(msg.origin);
  if (!site) {
    return { error: RPC_ERRORS.UNAUTHORIZED };
  }

  // signTypedData_v4 params: [account, typedDataJSON] -- verify account is authorized
  const account = msg.params?.[0] as string | undefined;
  if (account && !site.accounts.some((a) => a.toLowerCase() === account.toLowerCase())) {
    return { error: { code: 4100, message: 'Account not authorized for this site' } };
  }

  return new Promise((resolve) => {
    const reqId = crypto.randomUUID();
    const pending: PendingDappRequest = {
      id: reqId,
      rpcId: msg.id,
      method: msg.method,
      params: msg.params,
      origin: msg.origin,
      favicon: msg.favicon,
      title: msg.title,
      tabId: senderTabId,
      createdAt: Date.now(),
    };

    registerCallback(
      reqId,
      (result) => resolve({ result }),
      (error) => resolve({ error }),
    );

    storePendingRequest(pending).then(() => openApprovalPopup());
  });
}

// ---------------------------------------------------------------------------
// Dapp execution handlers (called by popup after user approval)
// ---------------------------------------------------------------------------

async function handleDappExecuteTx(
  requestId: string,
  txParams: {
    from: string;
    to: string;
    value?: string | undefined;
    data?: string | undefined;
    gas?: string | undefined;
    maxFeePerGas?: string | undefined;
    maxPriorityFeePerGas?: string | undefined;
  },
): Promise<WalletResponse> {
  const session = await getSession();
  if (!session) return { type: 'wallet:error', error: 'Wallet is locked' };
  const network = await getNetworkPreference();

  // Find account index from 'from' address
  const accountIndex = session.accounts.findIndex(
    (a) => a.address.toLowerCase() === txParams.from.toLowerCase(),
  );
  if (accountIndex === -1) return { type: 'wallet:error', error: 'Account not found' };

  // Re-verify account authorization for this origin (defense in depth)
  const pending = await getLatestPendingRequest();
  if (pending) {
    const site = await getConnectedSite(pending.origin);
    if (site && !site.accounts.some((a) => a.toLowerCase() === txParams.from.toLowerCase())) {
      return { type: 'wallet:error', error: 'Account not authorized for this site' };
    }
  }

  const seed = hexToBytes(session.seed);
  const account = session.accounts[accountIndex];
  if (!account) return { type: 'wallet:error', error: 'Account not found' };
  const kp = deriveAccount(seed, account.index);
  const value = BigInt(txParams.value || '0x0');

  try {
    const [nonceRaw, feeParams, gasLimit] = await Promise.all([
      rpcCall(network, 'eth_getTransactionCount', [kp.address, 'pending']),
      getFeeParams(network),
      txParams.gas
        ? Promise.resolve(BigInt(txParams.gas))
        : estimateGas(network, kp.address, txParams.to, value),
    ]);
    const nonce = BigInt(nonceRaw as string);

    const { chainId } = NETWORKS[network];
    const signedTx = buildAndSignTransaction({
      to: txParams.to,
      value,
      nonce,
      gasLimit: txParams.gas ? BigInt(txParams.gas) : gasLimit,
      maxFeePerGas: txParams.maxFeePerGas ? BigInt(txParams.maxFeePerGas) : feeParams.maxFeePerGas,
      maxPriorityFeePerGas: txParams.maxPriorityFeePerGas
        ? BigInt(txParams.maxPriorityFeePerGas)
        : feeParams.priorityFee,
      chainId,
      privateKey: kp.privateKey,
      data: txParams.data,
    });

    // Send via realtime first, fallback to standard
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
      txHash = (await rpcCall(network, 'eth_sendRawTransaction', [signedTx])) as string;
    }

    // Resolve the pending dapp request with the txHash
    resolveRequest(requestId, txHash);
    await removePendingRequest(requestId);

    return { type: 'dapp:txSent', txHash };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Transaction failed';
    rejectRequest(requestId, { code: -32603, message: error });
    await removePendingRequest(requestId);
    return { type: 'wallet:error', error };
  }
}

async function handleDappExecutePersonalSign(
  requestId: string,
  message: string,
  account: string,
): Promise<WalletResponse> {
  const session = await getSession();
  if (!session) return { type: 'wallet:error', error: 'Wallet is locked' };

  const accountIndex = session.accounts.findIndex(
    (a) => a.address.toLowerCase() === account.toLowerCase(),
  );
  if (accountIndex === -1) return { type: 'wallet:error', error: 'Account not found' };

  const seed = hexToBytes(session.seed);
  const acct = session.accounts[accountIndex];
  if (!acct) return { type: 'wallet:error', error: 'Account not found' };
  const kp = deriveAccount(seed, acct.index);

  try {
    const { eip191Signer } = await import('micro-eth-signer');
    const signature = eip191Signer.sign(message, kp.privateKey);

    resolveRequest(requestId, signature);
    await removePendingRequest(requestId);

    return { type: 'dapp:signed', signature };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Signing failed';
    rejectRequest(requestId, { code: -32603, message: error });
    await removePendingRequest(requestId);
    return { type: 'wallet:error', error };
  }
}

async function handleDappExecuteSignTypedData(
  requestId: string,
  typedData: unknown,
  account: string,
): Promise<WalletResponse> {
  const session = await getSession();
  if (!session) return { type: 'wallet:error', error: 'Wallet is locked' };

  const accountIndex = session.accounts.findIndex(
    (a) => a.address.toLowerCase() === account.toLowerCase(),
  );
  if (accountIndex === -1) return { type: 'wallet:error', error: 'Account not found' };

  const seed = hexToBytes(session.seed);
  const acct = session.accounts[accountIndex];
  if (!acct) return { type: 'wallet:error', error: 'Account not found' };
  const kp = deriveAccount(seed, acct.index);

  try {
    const { signTyped } = await import('micro-eth-signer');
    const signature = signTyped(typedData as Parameters<typeof signTyped>[0], kp.privateKey);

    resolveRequest(requestId, signature);
    await removePendingRequest(requestId);

    return { type: 'dapp:signed', signature };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Signing failed';
    rejectRequest(requestId, { code: -32603, message: error });
    await removePendingRequest(requestId);
    return { type: 'wallet:error', error };
  }
}

async function handleDappSimulate(txParams: {
  from: string;
  to: string;
  value?: string | undefined;
  data?: string | undefined;
}): Promise<WalletResponse> {
  const network = await getNetworkPreference();
  try {
    const balanceHex = await rpcCall(network, 'eth_getBalance', [txParams.from, 'latest']);
    const ethBefore = BigInt(balanceHex as string);

    // Simulate via eth_call -- if it reverts, the tx would fail
    try {
      await rpcCall(network, 'eth_call', [
        {
          from: txParams.from,
          to: txParams.to,
          data: txParams.data,
          value: txParams.value,
        },
        'latest',
      ]);
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Simulation failed';
      return {
        type: 'dapp:simulated',
        ethBefore: `0x${ethBefore.toString(16)}`,
        ethAfter: `0x${ethBefore.toString(16)}`,
        success: false,
        error,
      };
    }

    // Estimate the ETH diff (value transfer + gas)
    const valueBigInt = BigInt(txParams.value || '0x0');
    const ethAfter = ethBefore - valueBigInt;
    return {
      type: 'dapp:simulated',
      ethBefore: `0x${ethBefore.toString(16)}`,
      ethAfter: `0x${ethAfter.toString(16)}`,
      success: true,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Simulation failed';
    return {
      type: 'dapp:simulated',
      ethBefore: '0x0',
      ethAfter: '0x0',
      success: false,
      error,
    };
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

  if (msg.type?.startsWith('wallet:') || msg.type?.startsWith('dapp:')) {
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

  handleDappRpc(msg as DappRpcRequest, sender.tab?.id).then(sendResponse);
  return true; // async response
});

// ---------------------------------------------------------------------------
// Service worker initialization
// ---------------------------------------------------------------------------

console.log('[megawallet] background service worker started');

chrome.runtime.onInstalled.addListener(() => {
  console.log('[megawallet] extension installed');
});
