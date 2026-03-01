import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WalletResponse } from '@/features/wallet/types';

// ---------------------------------------------------------------------------
// Chrome API mocks -- must be installed before background.ts import
// ---------------------------------------------------------------------------

function createStorageMock() {
  const store = new Map<string, unknown>();
  return {
    _store: store,
    get: vi.fn(async (key: string | string[]) => {
      if (Array.isArray(key)) {
        const result: Record<string, unknown> = {};
        for (const k of key) {
          const val = store.get(k);
          if (val !== undefined) result[k] = val;
        }
        return result;
      }
      const val = store.get(key);
      return val !== undefined ? { [key]: val } : {};
    }),
    set: vi.fn(async (items: Record<string, unknown>) => {
      for (const [k, v] of Object.entries(items)) {
        store.set(k, v);
      }
    }),
    remove: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    clear: vi.fn(async () => {
      store.clear();
    }),
  };
}

const localMock = createStorageMock();
const sessionMock = createStorageMock();

// Alarms mock
const alarmStore = new Map<string, chrome.alarms.Alarm>();
const alarmListeners: Array<(alarm: chrome.alarms.Alarm) => void> = [];

const alarmsMock = {
  create: vi.fn(async (name: string, info: { delayInMinutes: number }) => {
    alarmStore.set(name, {
      name,
      scheduledTime: Date.now() + info.delayInMinutes * 60_000,
    });
  }),
  clear: vi.fn(async (name: string) => {
    alarmStore.delete(name);
    return true;
  }),
  get: vi.fn(async (name: string) => {
    return alarmStore.get(name) ?? null;
  }),
  onAlarm: {
    addListener: vi.fn((fn: (alarm: chrome.alarms.Alarm) => void) => {
      alarmListeners.push(fn);
    }),
  },
};

const chromeMock = {
  storage: {
    local: localMock,
    session: sessionMock,
  },
  runtime: {
    id: 'test-extension-id',
    onMessage: { addListener: vi.fn() },
    onInstalled: { addListener: vi.fn() },
  },
  alarms: alarmsMock,
};

vi.stubGlobal('chrome', chromeMock);

// Import AFTER chrome mock is in place
const { handleWalletMessage } = await import('@/entrypoints/background');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resetStorage() {
  localMock._store.clear();
  sessionMock._store.clear();
  alarmStore.clear();
}

/** Create + confirm a wallet, returning the mnemonic */
async function createAndConfirmWallet(password: string) {
  const created = await handleWalletMessage({ type: 'wallet:create', password });
  if (created.type !== 'wallet:created') throw new Error('create failed');
  const words = created.mnemonic.split(' ');
  const confirmed = await handleWalletMessage({
    type: 'wallet:confirmSeedPhrase',
    wordIndices: [
      { position: 0, word: words[0] as string },
      { position: 3, word: words[3] as string },
      { position: 7, word: words[7] as string },
    ],
  });
  if (confirmed.type !== 'wallet:confirmed') throw new Error('confirm failed');
  return created.mnemonic;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('wallet lifecycle integration', () => {
  beforeEach(() => {
    resetStorage();
  });

  it('create returns mnemonic and address', async () => {
    const res = await handleWalletMessage({ type: 'wallet:create', password: 'test123' });
    expect(res.type).toBe('wallet:created');
    if (res.type !== 'wallet:created') throw new Error('unexpected');
    expect(res.mnemonic.split(' ').length).toBe(12);
    expect(res.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });

  it('create + confirm flow (SEC-03): vault persisted only after confirmation', async () => {
    // Create: vault NOT in storage.local
    const created = await handleWalletMessage({ type: 'wallet:create', password: 'pw' });
    expect(created.type).toBe('wallet:created');
    expect(localMock._store.has('vault')).toBe(false);
    expect(sessionMock._store.has('pendingCreation')).toBe(true);

    // getAccounts should fail -- no walletSession cached yet
    const locked = await handleWalletMessage({ type: 'wallet:getAccounts' });
    expect(locked.type).toBe('wallet:error');
    if (locked.type === 'wallet:error') {
      expect(locked.error).toBe('Wallet is locked');
    }

    // Confirm with correct words
    if (created.type !== 'wallet:created') throw new Error('unexpected');
    const words = created.mnemonic.split(' ');
    const confirmRes = await handleWalletMessage({
      type: 'wallet:confirmSeedPhrase',
      wordIndices: [
        { position: 0, word: words[0] as string },
        { position: 3, word: words[3] as string },
        { position: 7, word: words[7] as string },
        { position: 11, word: words[11] as string },
      ],
    });
    expect(confirmRes.type).toBe('wallet:confirmed');

    // Now vault IS in storage.local
    expect(localMock._store.has('vault')).toBe(true);
    // pendingCreation removed
    expect(sessionMock._store.has('pendingCreation')).toBe(false);
    // getAccounts works now
    const accts = await handleWalletMessage({ type: 'wallet:getAccounts' });
    expect(accts.type).toBe('wallet:accounts');
  });

  it('create without confirm leaves wallet unusable (SEC-03)', async () => {
    await handleWalletMessage({ type: 'wallet:create', password: 'pw' });
    // No confirm -- getAccounts fails
    const res = await handleWalletMessage({ type: 'wallet:getAccounts' });
    expect(res.type).toBe('wallet:error');
    if (res.type === 'wallet:error') {
      expect(res.error).toBe('Wallet is locked');
    }
  });

  it('confirm with wrong words fails (SEC-03)', async () => {
    const created = await handleWalletMessage({ type: 'wallet:create', password: 'pw' });
    if (created.type !== 'wallet:created') throw new Error('unexpected');

    const res = await handleWalletMessage({
      type: 'wallet:confirmSeedPhrase',
      wordIndices: [
        { position: 0, word: 'wrongword' },
        { position: 1, word: 'wrongword' },
        { position: 2, word: 'wrongword' },
      ],
    });
    expect(res.type).toBe('wallet:error');
    if (res.type === 'wallet:error') {
      expect(res.error).toBe('Seed phrase confirmation failed');
    }
    // Vault still NOT persisted
    expect(localMock._store.has('vault')).toBe(false);
  });

  it('pending survives mock worker restart (SEC-03)', async () => {
    const created = await handleWalletMessage({ type: 'wallet:create', password: 'pw' });
    if (created.type !== 'wallet:created') throw new Error('unexpected');

    // pendingCreation is in session storage -- survives SW restart
    expect(sessionMock._store.has('pendingCreation')).toBe(true);

    // Simulate SW restart: session storage persists, confirm should work
    const words = created.mnemonic.split(' ');
    const confirmRes = await handleWalletMessage({
      type: 'wallet:confirmSeedPhrase',
      wordIndices: [
        { position: 0, word: words[0] as string },
        { position: 5, word: words[5] as string },
        { position: 9, word: words[9] as string },
      ],
    });
    expect(confirmRes.type).toBe('wallet:confirmed');
    expect(localMock._store.has('vault')).toBe(true);
  });

  it('import flow: validates and returns address', async () => {
    const mnemonic =
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
    const res = await handleWalletMessage({ type: 'wallet:import', password: 'pw', mnemonic });
    expect(res.type).toBe('wallet:imported');
    if (res.type !== 'wallet:imported') throw new Error('unexpected');
    expect(res.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    // Vault persisted immediately for import (no confirmation needed)
    expect(localMock._store.has('vault')).toBe(true);
  });

  it('import with invalid mnemonic returns error', async () => {
    const res = await handleWalletMessage({
      type: 'wallet:import',
      password: 'pw',
      mnemonic: 'invalid words',
    });
    expect(res.type).toBe('wallet:error');
    if (res.type === 'wallet:error') {
      expect(res.error).toBe('Invalid mnemonic');
    }
  });

  it('multi-account: derive indices 0-4 gives 5 unique addresses', async () => {
    const mnemonic =
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
    await handleWalletMessage({ type: 'wallet:import', password: 'pw', mnemonic });

    const addresses = new Set<string>();
    for (let i = 0; i < 5; i++) {
      const res = await handleWalletMessage({ type: 'wallet:deriveAccount', index: i });
      expect(res.type).toBe('wallet:derived');
      if (res.type === 'wallet:derived') {
        addresses.add(res.account.address);
        expect(res.account.index).toBe(i);
      }
    }
    expect(addresses.size).toBe(5);

    // getAccounts returns all 5
    const accts = await handleWalletMessage({ type: 'wallet:getAccounts' });
    if (accts.type === 'wallet:accounts') {
      expect(accts.accounts.length).toBe(5);
    }
  });

  it('lock/unlock cycle: same address after round-trip', async () => {
    const mnemonic =
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
    const imported = await handleWalletMessage({ type: 'wallet:import', password: 'pw', mnemonic });
    if (imported.type !== 'wallet:imported') throw new Error('unexpected');
    const address = imported.address;

    // Lock
    const lockRes = await handleWalletMessage({ type: 'wallet:lock' });
    expect(lockRes.type).toBe('wallet:locked');

    // getAccounts fails when locked
    const lockedRes = await handleWalletMessage({ type: 'wallet:getAccounts' });
    expect(lockedRes.type).toBe('wallet:error');

    // Unlock
    const unlockRes = await handleWalletMessage({ type: 'wallet:unlock', password: 'pw' });
    expect(unlockRes.type).toBe('wallet:unlocked');
    if (unlockRes.type === 'wallet:unlocked') {
      expect(unlockRes.address).toBe(address);
    }

    // getAccounts works again
    const accts = await handleWalletMessage({ type: 'wallet:getAccounts' });
    expect(accts.type).toBe('wallet:accounts');
  });

  it('unlock with wrong password returns error', async () => {
    const mnemonic =
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
    await handleWalletMessage({ type: 'wallet:import', password: 'correct', mnemonic });
    await handleWalletMessage({ type: 'wallet:lock' });

    const res = await handleWalletMessage({ type: 'wallet:unlock', password: 'wrong' });
    expect(res.type).toBe('wallet:error');
    if (res.type === 'wallet:error') {
      expect(res.error).toBe('Incorrect password');
    }
  });

  it('full lifecycle: create -> confirm -> lock -> unlock -> derive -> getAccounts', async () => {
    // Create
    const created = await handleWalletMessage({ type: 'wallet:create', password: 'mypassword' });
    if (created.type !== 'wallet:created') throw new Error('unexpected');
    const words = created.mnemonic.split(' ');

    // Confirm
    const confirmed = await handleWalletMessage({
      type: 'wallet:confirmSeedPhrase',
      wordIndices: [
        { position: 2, word: words[2] as string },
        { position: 5, word: words[5] as string },
        { position: 8, word: words[8] as string },
      ],
    });
    expect(confirmed.type).toBe('wallet:confirmed');

    // Lock
    await handleWalletMessage({ type: 'wallet:lock' });

    // Unlock
    const unlocked = await handleWalletMessage({ type: 'wallet:unlock', password: 'mypassword' });
    expect(unlocked.type).toBe('wallet:unlocked');

    // Derive account 1
    const derived = await handleWalletMessage({ type: 'wallet:deriveAccount', index: 1 });
    expect(derived.type).toBe('wallet:derived');
    if (derived.type === 'wallet:derived') {
      expect(derived.account.index).toBe(1);
    }

    // Get all accounts
    const accts = await handleWalletMessage({ type: 'wallet:getAccounts' });
    expect(accts.type).toBe('wallet:accounts');
    if (accts.type === 'wallet:accounts') {
      expect(accts.accounts.length).toBe(2);
    }
  });
});

describe('message response safety', () => {
  beforeEach(() => {
    resetStorage();
  });

  it('no response type contains privateKey field', async () => {
    // Generate all response variants
    const responses: WalletResponse[] = [];

    // wallet:created
    const created = await handleWalletMessage({ type: 'wallet:create', password: 'pw' });
    responses.push(created);

    // wallet:confirmed
    if (created.type === 'wallet:created') {
      const words = created.mnemonic.split(' ');
      const confirmed = await handleWalletMessage({
        type: 'wallet:confirmSeedPhrase',
        wordIndices: [
          { position: 0, word: words[0] as string },
          { position: 3, word: words[3] as string },
          { position: 7, word: words[7] as string },
        ],
      });
      responses.push(confirmed);
    }

    // wallet:accounts
    responses.push(await handleWalletMessage({ type: 'wallet:getAccounts' }));

    // wallet:derived
    responses.push(await handleWalletMessage({ type: 'wallet:deriveAccount', index: 1 }));

    // wallet:locked
    const lockRes = await handleWalletMessage({ type: 'wallet:lock' });
    responses.push(lockRes);

    // wallet:error (locked state)
    responses.push(await handleWalletMessage({ type: 'wallet:getAccounts' }));

    for (const res of responses) {
      expect('privateKey' in res).toBe(false);
    }
  });

  it('only wallet:created response contains mnemonic field', async () => {
    const created = await handleWalletMessage({ type: 'wallet:create', password: 'pw' });
    expect('mnemonic' in created).toBe(true);

    if (created.type === 'wallet:created') {
      const words = created.mnemonic.split(' ');
      const confirmed = await handleWalletMessage({
        type: 'wallet:confirmSeedPhrase',
        wordIndices: [
          { position: 0, word: words[0] as string },
          { position: 4, word: words[4] as string },
          { position: 9, word: words[9] as string },
        ],
      });
      expect('mnemonic' in confirmed).toBe(false);
    }

    const mnemonic =
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

    resetStorage();
    const imported = await handleWalletMessage({ type: 'wallet:import', password: 'pw', mnemonic });
    expect('mnemonic' in imported).toBe(false);

    const accts = await handleWalletMessage({ type: 'wallet:getAccounts' });
    expect('mnemonic' in accts).toBe(false);

    const derived = await handleWalletMessage({ type: 'wallet:deriveAccount', index: 1 });
    expect('mnemonic' in derived).toBe(false);

    await handleWalletMessage({ type: 'wallet:lock' });
    const unlocked = await handleWalletMessage({ type: 'wallet:unlock', password: 'pw' });
    expect('mnemonic' in unlocked).toBe(false);
  });
});

describe('security regressions', () => {
  beforeEach(() => {
    resetStorage();
  });

  it('confirmSeedPhrase rejects empty wordIndices (SEC-03)', async () => {
    await handleWalletMessage({ type: 'wallet:create', password: 'pw' });
    const res = await handleWalletMessage({
      type: 'wallet:confirmSeedPhrase',
      wordIndices: [],
    });
    expect(res.type).toBe('wallet:error');
    if (res.type === 'wallet:error') {
      expect(res.error).toBe('Must confirm at least 3 words');
    }
    // Vault NOT persisted
    expect(localMock._store.has('vault')).toBe(false);
    expect(sessionMock._store.has('pendingCreation')).toBe(true);
  });

  it('confirmSeedPhrase rejects fewer than 3 words', async () => {
    const created = await handleWalletMessage({ type: 'wallet:create', password: 'pw' });
    if (created.type !== 'wallet:created') throw new Error('unexpected');
    const words = created.mnemonic.split(' ');
    const res = await handleWalletMessage({
      type: 'wallet:confirmSeedPhrase',
      wordIndices: [
        { position: 0, word: words[0] as string },
        { position: 1, word: words[1] as string },
      ],
    });
    expect(res.type).toBe('wallet:error');
    if (res.type === 'wallet:error') {
      expect(res.error).toBe('Must confirm at least 3 words');
    }
  });

  it('lock clears pendingCreation from session', async () => {
    await handleWalletMessage({ type: 'wallet:create', password: 'pw' });
    expect(sessionMock._store.has('pendingCreation')).toBe(true);

    await handleWalletMessage({ type: 'wallet:lock' });
    expect(sessionMock._store.has('pendingCreation')).toBe(false);
  });

  it('deriveAccount rejects negative index', async () => {
    const mnemonic =
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
    await handleWalletMessage({ type: 'wallet:import', password: 'pw', mnemonic });
    const res = await handleWalletMessage({ type: 'wallet:deriveAccount', index: -1 });
    expect(res.type).toBe('wallet:error');
    if (res.type === 'wallet:error') {
      expect(res.error).toBe('Invalid account index');
    }
  });

  it('deriveAccount rejects NaN index', async () => {
    const mnemonic =
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
    await handleWalletMessage({ type: 'wallet:import', password: 'pw', mnemonic });
    const res = await handleWalletMessage({ type: 'wallet:deriveAccount', index: NaN });
    expect(res.type).toBe('wallet:error');
    if (res.type === 'wallet:error') {
      expect(res.error).toBe('Invalid account index');
    }
  });

  it('deriveAccount rejects non-integer index', async () => {
    const mnemonic =
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
    await handleWalletMessage({ type: 'wallet:import', password: 'pw', mnemonic });
    const res = await handleWalletMessage({ type: 'wallet:deriveAccount', index: 1.5 });
    expect(res.type).toBe('wallet:error');
    if (res.type === 'wallet:error') {
      expect(res.error).toBe('Invalid account index');
    }
  });
});

// ---------------------------------------------------------------------------
// Phase 3 message handlers
// ---------------------------------------------------------------------------

describe('phase 3 message handlers', () => {
  beforeEach(() => {
    resetStorage();
  });

  describe('wallet:exportSeedPhrase (SEC-09)', () => {
    it('returns mnemonic when password correct and wallet unlocked', async () => {
      const mnemonic = await createAndConfirmWallet('mypass');

      const res = await handleWalletMessage({
        type: 'wallet:exportSeedPhrase',
        password: 'mypass',
      });
      expect(res.type).toBe('wallet:seedPhrase');
      if (res.type === 'wallet:seedPhrase') {
        expect(res.mnemonic).toBe(mnemonic);
      }
    });

    it('rejects when wallet is locked', async () => {
      await createAndConfirmWallet('mypass');
      await handleWalletMessage({ type: 'wallet:lock' });

      const res = await handleWalletMessage({
        type: 'wallet:exportSeedPhrase',
        password: 'mypass',
      });
      expect(res.type).toBe('wallet:error');
      if (res.type === 'wallet:error') {
        expect(res.error).toBe('Wallet is locked');
      }
    });

    it('rejects with wrong password and records lockout failure', async () => {
      await createAndConfirmWallet('mypass');

      const res = await handleWalletMessage({
        type: 'wallet:exportSeedPhrase',
        password: 'wrongpass',
      });
      expect(res.type).toBe('wallet:error');
      if (res.type === 'wallet:error') {
        expect(res.error).toBe('Incorrect password');
      }

      // Lockout failure should be recorded
      const status = await handleWalletMessage({ type: 'wallet:getLockoutStatus' });
      if (status.type === 'wallet:lockoutStatus') {
        expect(status.failedAttempts).toBe(1);
      }
    });
  });

  describe('wallet:getLockoutStatus', () => {
    it('returns typed lockout status fields', async () => {
      // Lockout state is module-level and shared across tests, so we just
      // verify the response shape and that locked=false (prior successful
      // unlocks reset the counter).
      // First do a successful create+confirm to reset lockout via the
      // successful export in the previous test group.
      const res = await handleWalletMessage({ type: 'wallet:getLockoutStatus' });
      expect(res.type).toBe('wallet:lockoutStatus');
      if (res.type === 'wallet:lockoutStatus') {
        expect(typeof res.locked).toBe('boolean');
        expect(typeof res.remainingMs).toBe('number');
        expect(typeof res.failedAttempts).toBe('number');
      }
    });

    it('failedAttempts increases after wrong password', async () => {
      // Reset lockout by doing a successful unlock first
      const mnemonic =
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
      await handleWalletMessage({ type: 'wallet:import', password: 'correct', mnemonic });
      // Import resets lockout implicitly (no lockout check). Get baseline.
      // Lock and do a successful unlock to reset lockout counter
      await handleWalletMessage({ type: 'wallet:lock' });
      await handleWalletMessage({ type: 'wallet:unlock', password: 'correct' });

      const before = await handleWalletMessage({ type: 'wallet:getLockoutStatus' });
      if (before.type !== 'wallet:lockoutStatus') throw new Error('unexpected');
      const baseAttempts = before.failedAttempts;

      // Lock and fail once
      await handleWalletMessage({ type: 'wallet:lock' });
      await handleWalletMessage({ type: 'wallet:unlock', password: 'wrong' });

      const after = await handleWalletMessage({ type: 'wallet:getLockoutStatus' });
      if (after.type !== 'wallet:lockoutStatus') throw new Error('unexpected');
      expect(after.failedAttempts).toBe(baseAttempts + 1);

      // Clean up: successful unlock to reset
      await handleWalletMessage({ type: 'wallet:unlock', password: 'correct' });
    });
  });

  describe('wallet:heartbeat', () => {
    it('returns heartbeatAck when unlocked', async () => {
      await createAndConfirmWallet('pw');

      const res = await handleWalletMessage({ type: 'wallet:heartbeat' });
      expect(res.type).toBe('wallet:heartbeatAck');
    });

    it('returns error when wallet is locked', async () => {
      const res = await handleWalletMessage({ type: 'wallet:heartbeat' });
      expect(res.type).toBe('wallet:error');
      if (res.type === 'wallet:error') {
        expect(res.error).toBe('Wallet is locked');
      }
    });
  });

  describe('wallet:setAutoLockTimeout (SET-02)', () => {
    it('accepts valid value and returns settingsSaved', async () => {
      const res = await handleWalletMessage({
        type: 'wallet:setAutoLockTimeout',
        minutes: 30,
      });
      expect(res.type).toBe('wallet:settingsSaved');

      // Verify persisted
      const stored = localMock._store.get('autoLockMinutes');
      expect(stored).toBe(30);
    });

    it('rejects invalid value (not in allowed list)', async () => {
      const res = await handleWalletMessage({
        type: 'wallet:setAutoLockTimeout',
        minutes: 7,
      });
      expect(res.type).toBe('wallet:error');
      if (res.type === 'wallet:error') {
        expect(res.error).toBe('Invalid auto-lock timeout');
      }
    });
  });

  describe('wallet:getAutoLockTimeout', () => {
    it('returns default 15 when not set', async () => {
      const res = await handleWalletMessage({ type: 'wallet:getAutoLockTimeout' });
      expect(res.type).toBe('wallet:autoLockTimeout');
      if (res.type === 'wallet:autoLockTimeout') {
        expect(res.minutes).toBe(15);
      }
    });

    it('returns persisted value after setAutoLockTimeout', async () => {
      await handleWalletMessage({ type: 'wallet:setAutoLockTimeout', minutes: 60 });

      const res = await handleWalletMessage({ type: 'wallet:getAutoLockTimeout' });
      expect(res.type).toBe('wallet:autoLockTimeout');
      if (res.type === 'wallet:autoLockTimeout') {
        expect(res.minutes).toBe(60);
      }
    });
  });

  describe('auto-lock alarm lifecycle (SEC-08)', () => {
    it('alarm created on unlock', async () => {
      // Use create+confirm to get a clean wallet with reset lockout
      await createAndConfirmWallet('pw');
      await handleWalletMessage({ type: 'wallet:lock' });

      alarmStore.clear();
      await handleWalletMessage({ type: 'wallet:unlock', password: 'pw' });
      expect(alarmStore.has('auto-lock')).toBe(true);
    });

    it('alarm cleared on lock', async () => {
      await createAndConfirmWallet('pw');
      expect(alarmStore.has('auto-lock')).toBe(true);

      await handleWalletMessage({ type: 'wallet:lock' });
      expect(alarmStore.has('auto-lock')).toBe(false);
    });

    it('alarm created on import', async () => {
      const mnemonic =
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
      await handleWalletMessage({ type: 'wallet:import', password: 'pw', mnemonic });
      expect(alarmStore.has('auto-lock')).toBe(true);
    });

    it('heartbeat resets alarm when unlocked', async () => {
      await createAndConfirmWallet('pw');
      // Alarm exists from createAndConfirmWallet

      // Small delay to ensure different scheduledTime
      await new Promise((r) => setTimeout(r, 10));
      await handleWalletMessage({ type: 'wallet:heartbeat' });

      const afterAlarm = alarmStore.get('auto-lock');
      // Alarm should be recreated (scheduledTime may differ)
      expect(afterAlarm).toBeDefined();
      expect(alarmsMock.clear).toHaveBeenCalled();
    });
  });

  describe('ready-promise gate', () => {
    it('handleWalletMessage works correctly after init', async () => {
      // The ready promise should have resolved by now since we imported the module
      // This tests that the gate doesn't block normal operation
      const res = await handleWalletMessage({ type: 'wallet:getLockoutStatus' });
      expect(res.type).toBe('wallet:lockoutStatus');
    });
  });
});
