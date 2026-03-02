// Vault blob stored in chrome.storage.local
export interface VaultBlob {
  version: 1;
  kdf: {
    algorithm: 'PBKDF2';
    hash: 'SHA-256';
    iterations: number; // 600_000+
    salt: string; // hex-encoded, 16 bytes random
  };
  cipher: {
    algorithm: 'AES-256-GCM';
    iv: string; // hex-encoded, 12 bytes random
  };
  data: string; // hex-encoded ciphertext (includes GCM auth tag)
}

// Plaintext stored inside encrypted vault
export interface VaultPlaintext {
  mnemonic: string; // BIP-39 mnemonic phrase
  createdAt: number; // unix timestamp ms
}

// A derived account (public info only -- safe to pass outside background)
export interface DerivedAccount {
  index: number; // BIP-44 address_index
  address: string; // EIP-55 checksummed 0x address
  path: string; // full derivation path
}

// Internal key pair (NEVER leaves background service worker)
export interface KeyPair {
  privateKey: Uint8Array; // 32 bytes
  address: string; // EIP-55 checksummed
  path: string; // derivation path
}

// Lockout state -- persisted to chrome.storage.session
export interface LockoutState {
  failedAttempts: number;
  lockedUntil: number; // timestamp ms, 0 = not locked
}

// Lockout manager returned by createLockoutManager()
export interface LockoutManager {
  checkLockout(): { locked: boolean; remainingMs: number };
  recordFailure(): void;
  reset(): void;
  serialize(): LockoutState;
}

// Recent address entry for send history
export interface RecentAddress {
  address: string;
  timestamp: number;
}

// Message types -- popup sends to background
export type WalletMessage =
  | { type: 'wallet:create'; password: string; strength?: 128 | 256 }
  | {
      type: 'wallet:confirmSeedPhrase';
      wordIndices: Array<{ position: number; word: string }>;
    } // SEC-03: proof-of-confirmation
  | { type: 'wallet:import'; password: string; mnemonic: string }
  | { type: 'wallet:unlock'; password: string }
  | { type: 'wallet:lock' }
  | { type: 'wallet:getAccounts' }
  | { type: 'wallet:getLockoutStatus' }
  | { type: 'wallet:deriveAccount'; index: number }
  | { type: 'wallet:exportSeedPhrase'; password: string }
  | { type: 'wallet:setAutoLockTimeout'; minutes: number }
  | { type: 'wallet:getAutoLockTimeout' }
  | { type: 'wallet:heartbeat' }
  | { type: 'wallet:getBalance'; accountIndex: number }
  | { type: 'wallet:estimateGas'; to: string; value: string; accountIndex: number }
  | { type: 'wallet:getFeeParams' }
  | { type: 'wallet:getEthPrice' }
  | { type: 'wallet:sendTransaction'; to: string; value: string; accountIndex: number }
  | { type: 'dapp:approve'; requestId: string; result: unknown }
  | { type: 'dapp:reject'; requestId: string }
  | { type: 'dapp:getPendingRequest' }
  | {
      type: 'dapp:executeTx';
      requestId: string;
      txParams: {
        from: string;
        to: string;
        value?: string | undefined;
        data?: string | undefined;
        gas?: string | undefined;
        maxFeePerGas?: string | undefined;
        maxPriorityFeePerGas?: string | undefined;
      };
    }
  | { type: 'dapp:signPersonal'; requestId: string; message: string; account: string }
  | { type: 'dapp:signTypedData'; requestId: string; typedData: unknown; account: string }
  | {
      type: 'dapp:simulate';
      txParams: {
        from: string;
        to: string;
        value?: string | undefined;
        data?: string | undefined;
      };
    };

// Response types -- background sends back
export type WalletResponse =
  | { type: 'wallet:created'; address: string; mnemonic: string }
  | { type: 'wallet:confirmed'; address: string } // SEC-03: seed confirmed, vault persisted
  | { type: 'wallet:imported'; address: string }
  | { type: 'wallet:unlocked'; address: string }
  | { type: 'wallet:locked' }
  | { type: 'wallet:accounts'; accounts: DerivedAccount[] }
  | { type: 'wallet:derived'; account: DerivedAccount }
  | {
      type: 'wallet:lockoutStatus';
      locked: boolean;
      remainingMs: number;
      failedAttempts: number;
    }
  | { type: 'wallet:seedPhrase'; mnemonic: string }
  | { type: 'wallet:autoLockTimeout'; minutes: number }
  | { type: 'wallet:settingsSaved' }
  | { type: 'wallet:heartbeatAck' }
  | {
      type: 'wallet:balance';
      balanceWei: string;
      balanceEth: string;
    }
  | {
      type: 'wallet:gasEstimate';
      gasLimit: string;
      maxFeePerGas: string;
      maxPriorityFeePerGas: string;
      estimatedFeeWei: string;
      estimatedFeeEth: string;
    }
  | {
      type: 'wallet:feeParams';
      baseFee: string;
      priorityFee: string;
      maxFeePerGas: string;
    }
  | { type: 'wallet:ethPrice'; usd: number }
  | {
      type: 'wallet:txResult';
      success: boolean;
      txHash: string;
      explorerUrl: string;
      error?: string;
    }
  | { type: 'wallet:error'; error: string }
  | { type: 'dapp:pendingRequest'; request: unknown | null }
  | { type: 'dapp:approved' }
  | { type: 'dapp:rejected' }
  | { type: 'dapp:txSent'; txHash: string }
  | { type: 'dapp:signed'; signature: string }
  | {
      type: 'dapp:simulated';
      ethBefore: string;
      ethAfter: string;
      success: boolean;
      error?: string | undefined;
    };
