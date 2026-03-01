// TEST-03: EIP-1559 Type 2 transaction serialization

import { hexToBytes } from '@noble/hashes/utils.js';
import { Transaction } from 'micro-eth-signer';
import { describe, expect, it } from 'vitest';
import { buildAndSignTransaction } from '@/features/wallet/tx/build';

const TEST_KEY_1 = hexToBytes(
  '0000000000000000000000000000000000000000000000000000000000000001',
);
const TEST_ADDR_1 = '0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf';

const TEST_KEY_2 = hexToBytes(
  '0000000000000000000000000000000000000000000000000000000000000002',
);
const TEST_ADDR_2 = '0x2B5AD5c4795c026514f8317c7a215E218DcCD6cF';

describe('EIP-1559 Type 2 Transaction Serialization', () => {
  it('produces 0x02 type prefix', () => {
    const hex = buildAndSignTransaction({
      to: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
      value: 1_000_000_000_000_000_000n,
      nonce: 0n,
      gasLimit: 21_000n,
      maxFeePerGas: 20_000_000_000n,
      maxPriorityFeePerGas: 1_000_000_000n,
      chainId: 1,
      privateKey: TEST_KEY_1,
    });
    expect(hex.startsWith('0x02')).toBe(true);
  });

  it('roundtrip case 1: standard transfer', () => {
    const params = {
      to: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
      value: 1_000_000_000_000_000_000n,
      nonce: 0n,
      gasLimit: 21_000n,
      maxFeePerGas: 20_000_000_000n,
      maxPriorityFeePerGas: 1_000_000_000n,
      chainId: 1,
      privateKey: TEST_KEY_1,
    };
    const hex = buildAndSignTransaction(params);
    const decoded = Transaction.fromHex(hex);

    expect(decoded.sender.toLowerCase()).toBe(TEST_ADDR_1.toLowerCase());
    expect(decoded.raw.to?.toLowerCase()).toBe(params.to.toLowerCase());
    expect(decoded.raw.value).toBe(params.value);
    expect(decoded.raw.nonce).toBe(params.nonce);
    expect(decoded.raw.chainId).toBe(BigInt(params.chainId));
    expect(decoded.raw.gasLimit).toBe(params.gasLimit);
    expect(decoded.raw.maxFeePerGas).toBe(params.maxFeePerGas);
    expect(decoded.raw.maxPriorityFeePerGas).toBe(params.maxPriorityFeePerGas);
  });

  it('roundtrip case 2: different key + large value', () => {
    const params = {
      to: '0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf',
      value: 99_999_999_999_999_999_999n,
      nonce: 42n,
      gasLimit: 100_000n,
      maxFeePerGas: 50_000_000_000n,
      maxPriorityFeePerGas: 2_000_000_000n,
      chainId: 1,
      privateKey: TEST_KEY_2,
    };
    const hex = buildAndSignTransaction(params);
    const decoded = Transaction.fromHex(hex);

    expect(decoded.sender.toLowerCase()).toBe(TEST_ADDR_2.toLowerCase());
    expect(decoded.raw.to?.toLowerCase()).toBe(params.to.toLowerCase());
    expect(decoded.raw.value).toBe(params.value);
    expect(decoded.raw.nonce).toBe(params.nonce);
    expect(decoded.raw.chainId).toBe(BigInt(params.chainId));
  });

  it('roundtrip: zero-value tx at 0xff nonce boundary', () => {
    const params = {
      to: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
      value: 0n,
      nonce: 255n,
      gasLimit: 60_000n,
      maxFeePerGas: 1n,
      maxPriorityFeePerGas: 1n,
      chainId: 1,
      privateKey: TEST_KEY_1,
    };
    const hex = buildAndSignTransaction(params);
    const decoded = Transaction.fromHex(hex);

    expect(decoded.sender.toLowerCase()).toBe(TEST_ADDR_1.toLowerCase());
    expect(decoded.raw.value).toBe(0n);
    expect(decoded.raw.nonce).toBe(255n);
  });

  it('known-vector: unsigned RLP byte-for-byte match + valid signature', () => {
    // Known EIP-1559 Type 2 test vector
    // Private key: 0x0000...0001 (secp256k1 generator, well-known)
    // chainId=1, nonce=0, maxPriorityFeePerGas=1gwei, maxFeePerGas=20gwei,
    // gasLimit=21000, to=vitalik.eth, value=0, data="", accessList=[]
    //
    // Expected unsigned RLP: 0x02 || rlp([chainId, nonce, maxPriorityFeePerGas,
    //   maxFeePerGas, gasLimit, to, value, data, accessList])
    // Hardcoded from EIP-2718 + EIP-1559 RLP encoding spec:
    const EXPECTED_UNSIGNED =
      '0x02e80180843b9aca008504a817c80082520894d8da6bf26964af9d7eed9e03e53415d37aa960458080c0';

    const params = {
      to: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
      value: 0n,
      nonce: 0n,
      gasLimit: 21_000n,
      maxFeePerGas: 20_000_000_000n,
      maxPriorityFeePerGas: 1_000_000_000n,
      chainId: 1,
      privateKey: TEST_KEY_1,
    };

    const signedHex = buildAndSignTransaction(params);
    expect(signedHex.startsWith('0x02')).toBe(true);

    const decoded = Transaction.fromHex(signedHex);
    expect(decoded.type).toBe('eip1559');
    expect(decoded.isSigned).toBe(true);

    // 1. Unsigned RLP must match known vector byte-for-byte
    //    This catches: field ordering, access list encoding, chainId encoding
    expect(decoded.toHex(false)).toBe(EXPECTED_UNSIGNED);

    // 2. Signature must be valid (catches recovery bit issues)
    expect(decoded.verifySignature()).toBe(true);

    // 3. Sender recovery must match known address for key 0x01
    expect(decoded.sender.toLowerCase()).toBe(TEST_ADDR_1.toLowerCase());
  });
});
