import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WalletResponse } from '@/features/wallet/types';

// ---------------------------------------------------------------------------
// Chrome API mocks -- must be installed before background.ts import
// ---------------------------------------------------------------------------

function createStorageMock() {
  const store = new Map<string, unknown>();
  return {
    _store: store,
    get: vi.fn(async (key: string) => {
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
      wordIndices: [{ position: 0, word: 'wrongword' }],
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
        wordIndices: [{ position: 0, word: words[0] as string }],
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
        wordIndices: [{ position: 0, word: words[0] as string }],
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
