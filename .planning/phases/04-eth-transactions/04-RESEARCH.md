# Phase 4: ETH Transactions - Research

**Researched:** 2026-03-01
**Domain:** Ethereum EIP-1559 transaction construction, signing, RPC interaction, megaETH realtime submission
**Confidence:** HIGH

## Summary

Phase 4 requires building the complete ETH send flow: RPC provider module (balance fetch, gas estimation, fee queries, nonce, tx submission), EIP-1559 Type 2 transaction construction + signing, and a three-screen send UI (recipient, amount, confirmation) with result display. The existing `@noble/curves` and `@noble/hashes` libraries are already installed, and `micro-eth-signer` from the same author (paulmillr) provides audited Transaction construction, RLP encoding, and signing on top of them -- no need to hand-roll any of this.

megaETH's `realtime_sendRawTransaction` returns a full receipt synchronously (typically ~10ms), with a 10s timeout fallback to standard `eth_sendRawTransaction` + `eth_getTransactionReceipt` polling. Gas estimation must use `eth_estimateGas` with a 60k floor and 20% buffer. megaETH's base fee is effectively static at 0.001 gwei (10^6 wei) with EIP-1559 adjustment disabled, simplifying fee calculation.

**Primary recommendation:** Use `micro-eth-signer` (v0.18.1) for Transaction/RLP/signing. Build a thin RPC module around raw `fetch()` calls. Hand-roll nothing cryptographic.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Three-step send flow (Phantom-style): Recipient screen -> Amount screen -> Confirmation screen
- Each field gets a dedicated screen for focus and clarity
- Paste field with address validation (checksum, length, format)
- Recent addresses list below the input (store previously sent-to addresses)
- No QR scan or contacts in this phase
- ETH as primary input, fiat equivalent updates below in real time
- Toggle to swap primary (ETH <-> fiat)
- "Max" button deducts estimated gas and fills maximum sendable ETH
- Price source: CoinGecko API (free tier, no API key)
- Card-style confirmation layout: From -> To, Amount (ETH + fiat), Fee, Total
- Recipient displayed as truncated address with jazzicon avatar, tap to expand
- Gas cost: single summary line with expandable details (gas limit, max fee per gas, max priority fee)
- No gas editing in Phase 4 -- auto-estimated only
- Confirm + Cancel buttons at bottom
- Spinner on Confirm button + "Sending..." text while tx is in flight (no dedicated pending screen)
- Full-screen success result with checkmark animation + explorer link
- Error result screen with clear message + "Try Again" / "Cancel" buttons
- ETH primary (large text) + fiat equivalent below (smaller), replacing BalancePlaceholder
- Up to 4 significant decimal places, auto-trim trailing zeros
- Fiat formatted with locale currency formatting
- Fetch balance on popup open and after successful send (no interval polling)
- Shimmer skeleton animation while balance is loading

### Claude's Discretion
- RPC provider module architecture
- EIP-1559 fee parameter calculation strategy
- Transaction signing implementation details
- RLP encoding approach
- Nonce management implementation
- Recent addresses storage format and limit
- Exact shimmer skeleton styling
- Error message copy for edge cases
- CoinGecko API polling/caching strategy
- Explorer URL format for megaETH

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TX-01 | User can enter recipient address and ETH amount to send | Three-screen send flow; `addr.isValid()` from micro-eth-signer for address validation |
| TX-02 | "Max" button calculates maximum sendable amount after gas | `Transaction.setWholeAmount()` or manual `balance - (gasLimit * maxFeePerGas)` calculation |
| TX-03 | Gas estimation always uses megaETH RPC eth_estimateGas | RPC module calls `eth_estimateGas`; never local simulation |
| TX-04 | Gas limit enforces 60,000 minimum floor | `Math.max(estimate, 60000n)` after RPC response |
| TX-05 | 20% gas buffer applied on top of RPC estimate | `estimate + estimate / 5n` (bigint math) applied before floor check |
| TX-06 | Confirmation screen shows recipient, amount, gas cost, total cost | Card-style layout with expandable gas details |
| TX-07 | Submit tx via realtime_sendRawTransaction for instant receipt | RPC module sends to `realtime_sendRawTransaction`, returns receipt directly |
| TX-08 | Fallback to standard send + poll if realtime times out (10s) | Catch "realtime transaction expired" error, fallback to `eth_sendRawTransaction` + poll `eth_getTransactionReceipt` |
| TX-09 | Transaction result (success/failure) with block explorer link | Success/error result screens; explorer URLs: `mega.etherscan.io/tx/{hash}` (mainnet), `megaeth-testnet-v2.blockscout.com/tx/{hash}` (testnet) |
| TX-15 | Nonce fetched from network via eth_getTransactionCount pending | RPC call `eth_getTransactionCount(address, "pending")` before each tx |
| TX-16 | EIP-1559 Type 2 transaction construction and RLP serialization | `micro-eth-signer` Transaction.prepare() + signBy() handles Type 2 + RLP + signing |
| TEST-03 | Transaction serialization validated against known RLP test vectors | Use known private key + tx params, compare `signedTx.toHex()` against reference |
| TEST-04 | Gas estimation floor test: no tx submitted with gas < 60,000 | Unit test: mock eth_estimateGas returning values below 60k, assert gasLimit >= 60000 |
| TEST-06 | Nonce correctness: sequential txs use sequential nonces | Unit test: mock eth_getTransactionCount, verify sequential nonce increment |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `micro-eth-signer` | 0.18.1 | EIP-1559 tx construction, RLP encoding, signing, address validation | Same author as @noble/curves (paulmillr). Audited, minimal, zero-dep beyond noble. Already-compatible versions of @noble/curves ^2.0.0 and @noble/hashes ^2.0.0 |
| `@noble/curves` | 2.0.1 (installed) | secp256k1 ECDSA (used internally by micro-eth-signer) | Already installed |
| `@noble/hashes` | 2.0.1 (installed) | keccak256, SHA-256 (used internally by micro-eth-signer) | Already installed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `micro-packed` | ^0.8.0 | Binary structure encoding (RLP internals) | Transitive dep of micro-eth-signer, not imported directly |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| micro-eth-signer | Hand-roll RLP + signing | micro-eth-signer is 1.87KB, audited, same ecosystem. Hand-rolling risks subtle bugs in RLP edge cases and signature recovery bit |
| micro-eth-signer | ethers.js | ethers.js is 400KB+, massive dependency tree, overkill for tx construction only |
| micro-eth-signer | viem | viem is 200KB+, tree-shakeable but still large, TypeScript-first but heavy |
| micro-eth-signer | @ethereumjs/tx + @ethereumjs/rlp | Multi-package, larger bundle, separate authors from existing noble stack |
| CoinGecko API | CoinMarketCap, CryptoCompare | CoinGecko free tier requires no API key, 30 calls/min, sufficient for price display |

**Installation:**
```bash
pnpm add micro-eth-signer@0.18.1
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── features/
│   ├── wallet/
│   │   ├── crypto/          # existing - key derivation, vault encryption
│   │   ├── rpc/             # NEW - RPC provider module
│   │   │   ├── provider.ts  # JSON-RPC fetch wrapper, network config
│   │   │   ├── gas.ts       # gas estimation with floor + buffer
│   │   │   └── index.ts     # barrel export
│   │   ├── tx/              # NEW - transaction construction
│   │   │   ├── build.ts     # Transaction.prepare() wrapper with megaETH defaults
│   │   │   ├── sign.ts      # signing in background SW context
│   │   │   └── index.ts     # barrel export
│   │   ├── price/           # NEW - CoinGecko price fetching
│   │   │   └── coingecko.ts # simple/price endpoint, caching
│   │   ├── types.ts         # add WalletMessage/WalletResponse tx variants
│   │   ├── messages.ts      # unchanged
│   │   └── store.ts         # add send screens, balance state
│   └── ui/
│       ├── screens/
│       │   ├── SendRecipientScreen.tsx  # NEW
│       │   ├── SendAmountScreen.tsx     # NEW
│       │   ├── SendConfirmScreen.tsx    # NEW
│       │   └── SendResultScreen.tsx     # NEW
│       └── components/
│           ├── BalanceDisplay.tsx       # NEW - replaces BalancePlaceholder
│           └── ShimmerSkeleton.tsx      # NEW - loading placeholder
```

### Pattern 1: RPC Provider Module
**What:** Thin wrapper around `fetch()` for JSON-RPC calls, with network-aware endpoint selection
**When to use:** All RPC interactions (balance, gas, nonce, tx submission)
**Example:**
```typescript
// src/features/wallet/rpc/provider.ts
interface RpcConfig {
  mainnet: { rpcUrl: string; chainId: number; explorerUrl: string };
  testnet: { rpcUrl: string; chainId: number; explorerUrl: string };
}

const NETWORKS: RpcConfig = {
  mainnet: {
    rpcUrl: 'https://mainnet.megaeth.com/rpc',
    chainId: 4326,
    explorerUrl: 'https://mega.etherscan.io',
  },
  testnet: {
    rpcUrl: 'https://carrot.megaeth.com/rpc',
    chainId: 6343,
    explorerUrl: 'https://megaeth-testnet-v2.blockscout.com',
  },
};

async function rpcCall(network: 'mainnet' | 'testnet', method: string, params: unknown[]): Promise<unknown> {
  const { rpcUrl } = NETWORKS[network];
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.result;
}
```

### Pattern 2: Gas Estimation with Floor + Buffer
**What:** Fetch gas estimate from RPC, apply 20% buffer, enforce 60k minimum
**When to use:** Before every transaction
**Example:**
```typescript
// src/features/wallet/rpc/gas.ts
const GAS_FLOOR = 60_000n;
const GAS_BUFFER_PERCENT = 20n;

async function estimateGas(
  network: 'mainnet' | 'testnet',
  from: string,
  to: string,
  value: bigint,
): Promise<bigint> {
  const raw = await rpcCall(network, 'eth_estimateGas', [
    { from, to, value: '0x' + value.toString(16) },
  ]);
  const estimate = BigInt(raw as string);
  const buffered = estimate + (estimate * GAS_BUFFER_PERCENT) / 100n;
  return buffered > GAS_FLOOR ? buffered : GAS_FLOOR;
}
```

### Pattern 3: Transaction Build + Sign in Background
**What:** All signing happens in background service worker where private keys live
**When to use:** Every transaction submission
**Example:**
```typescript
// src/features/wallet/tx/build.ts
import { Transaction } from 'micro-eth-signer';

function buildTransaction(params: {
  to: string;
  value: bigint;
  nonce: bigint;
  gasLimit: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  chainId: number;
}) {
  return Transaction.prepare({
    to: params.to,
    value: params.value,
    nonce: params.nonce,
    gasLimit: params.gasLimit,
    maxFeePerGas: params.maxFeePerGas,
    maxPriorityFeePerGas: params.maxPriorityFeePerGas,
    chainId: params.chainId,
  });
}
```

### Pattern 4: Realtime Submit with Fallback
**What:** Try realtime_sendRawTransaction first, fall back to standard on timeout
**When to use:** Every transaction submission
**Example:**
```typescript
async function submitTransaction(
  network: 'mainnet' | 'testnet',
  signedTxHex: string,
): Promise<TransactionResult> {
  try {
    // Try realtime first -- returns receipt directly
    const receipt = await rpcCall(network, 'realtime_sendRawTransaction', [signedTxHex]);
    return { success: true, receipt };
  } catch (err) {
    if (err.message?.includes('realtime transaction expired')) {
      // Fallback: standard send + poll
      const txHash = await rpcCall(network, 'eth_sendRawTransaction', [signedTxHex]);
      const receipt = await pollReceipt(network, txHash as string, 10_000);
      return { success: true, receipt };
    }
    throw err;
  }
}

async function pollReceipt(network: string, txHash: string, timeoutMs: number) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const receipt = await rpcCall(network, 'eth_getTransactionReceipt', [txHash]);
    if (receipt) return receipt;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('Transaction receipt timeout');
}
```

### Pattern 5: Message-Based TX Flow (Popup <-> Background)
**What:** Popup sends structured messages, background handles signing and submission
**When to use:** Follows existing wallet message pattern
**Example:**
```typescript
// New WalletMessage variants
| { type: 'wallet:getBalance' }
| { type: 'wallet:estimateGas'; to: string; value: string }
| { type: 'wallet:getEthPrice' }
| { type: 'wallet:sendTransaction'; to: string; value: string; accountIndex: number }

// New WalletResponse variants
| { type: 'wallet:balance'; balanceWei: string; balanceEth: string }
| { type: 'wallet:gasEstimate'; gasLimit: string; maxFeePerGas: string; maxPriorityFeePerGas: string; estimatedFeeWei: string }
| { type: 'wallet:ethPrice'; usd: number }
| { type: 'wallet:txResult'; success: boolean; txHash: string; explorerUrl: string; error?: string }
```

### Anti-Patterns to Avoid
- **Importing private keys into popup:** All signing MUST happen in background SW. Popup sends message, background signs + submits.
- **Hardcoding gas values:** Always call `eth_estimateGas` from megaETH RPC. Never use a fixed gas value.
- **Using ethers.js or web3.js:** These are 200-400KB+ libraries. micro-eth-signer does exactly what's needed in <2KB.
- **Polling balance on interval:** Phase 4 uses fetch-on-demand only. WebSocket streaming is Phase 6.
- **Skipping the gas floor:** megaETH requires minimum 60k gas. Transactions with less will fail.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| RLP encoding | Custom RLP encoder | `micro-eth-signer` (includes RLP via `micro-packed`) | RLP has subtle edge cases (empty lists, single byte vs string, length-of-length encoding). Bugs cause silent invalid transactions |
| EIP-1559 tx construction | Manual field ordering + type prefix | `Transaction.prepare()` from micro-eth-signer | Field ordering, access list encoding, chain ID handling, signature recovery bit all handled correctly |
| Transaction signing | Manual keccak256 + secp256k1.sign | `tx.signBy()` from micro-eth-signer | Handles domain separation (0x02 prefix), low-S normalization, recovery bit calculation |
| "Send max" calculation | Manual balance - fee math | `Transaction.setWholeAmount()` | Gas fee subtraction is tricky with EIP-1559 (maxFeePerGas vs actual cost) |
| Address validation | Regex matching | `addr.isValid()` from micro-eth-signer | EIP-55 checksum validation, length checks, proper hex parsing |
| Wei/Gwei/ETH conversion | Manual BigInt division | `weieth.decode()` / `weigwei.decode()` from micro-eth-signer | Decimal precision handling for ETH amounts |

**Key insight:** Transaction construction is a solved problem with well-audited libraries. Hand-rolling any crypto/serialization code introduces risk of funds loss with zero benefit. `micro-eth-signer` is from the same author as the noble/scure libraries already trusted in this project.

## Common Pitfalls

### Pitfall 1: Gas Estimate Below Floor
**What goes wrong:** megaETH estimates gas accurately but some simple transfers estimate <60k. Submitting with that gas limit causes failure.
**Why it happens:** megaETH's gas model differs from Ethereum mainnet. Simple ETH transfers may estimate at 21k but need 60k minimum.
**How to avoid:** Always apply: `max(estimate * 1.2, 60000)`. The 20% buffer goes BEFORE the floor check.
**Warning signs:** "intrinsic gas too low" errors on submission.

### Pitfall 2: Nonce Gaps
**What goes wrong:** Sequential transactions sent rapidly can reuse the same nonce if both fetch `eth_getTransactionCount` before the first confirms.
**Why it happens:** megaETH confirms in ~10ms, but if two sends are triggered before the first receipt returns, both get the same nonce.
**How to avoid:** For Phase 4 (single send at a time), fetch nonce with "pending" tag immediately before signing. Disable send button while tx is in flight. For future batch sends, maintain a local nonce counter.
**Warning signs:** "nonce too low" or "replacement transaction underpriced" errors.

### Pitfall 3: BigInt Serialization Across Message Boundary
**What goes wrong:** `chrome.runtime.sendMessage` uses JSON serialization, which cannot handle BigInt values.
**Why it happens:** EIP-1559 values (gas, value, fees) are naturally BigInt. JSON.stringify throws on BigInt.
**How to avoid:** Convert all BigInt to hex strings ("0x...") or decimal strings before sending via chrome.runtime.sendMessage. Parse back to BigInt in the receiver.
**Warning signs:** "Do not know how to serialize a BigInt" runtime error.

### Pitfall 4: Stale ETH Price During Send Flow
**What goes wrong:** Price shown on amount screen differs from price on confirmation screen because CoinGecko response changed between fetches.
**Why it happens:** If price is re-fetched on each screen transition, volatile markets cause inconsistency.
**How to avoid:** Fetch price once when entering send flow, pass through screens as state. Only refresh if user explicitly returns to amount screen.
**Warning signs:** User sees different fiat values on adjacent screens.

### Pitfall 5: Missing 0x02 Type Prefix
**What goes wrong:** Signed transaction hex is sent without the EIP-2718 type prefix, causing RPC rejection.
**Why it happens:** Manual serialization might forget to prepend `0x02` before the RLP payload.
**How to avoid:** Use `micro-eth-signer`'s `signedTx.toHex()` which includes the type prefix automatically.
**Warning signs:** "invalid transaction type" or "rlp: expected List" errors from RPC.

### Pitfall 6: CoinGecko Rate Limiting
**What goes wrong:** Rapid popup opens or screen transitions trigger too many price fetches, hitting 30 calls/min limit.
**Why it happens:** Each popup open triggers balance + price fetch. Users opening/closing rapidly exhaust quota.
**How to avoid:** Cache price for 60s minimum. Only fetch fresh price when cache is stale. Show cached price with "as of X ago" if needed.
**Warning signs:** HTTP 429 responses from CoinGecko API.

### Pitfall 7: Service Worker Suspension During TX
**What goes wrong:** MV3 service worker suspends mid-transaction, losing in-flight state.
**Why it happens:** Chrome suspends idle service workers after 30s. If a fallback poll takes >30s, the SW may suspend.
**How to avoid:** megaETH's realtime method returns in ~10ms, so this is unlikely. For fallback polling, keep the SW alive with chrome.alarms or respond within the initial message handler's execution context.
**Warning signs:** Transaction sent but result never returned to popup.

## Code Examples

### Complete Transaction Flow (Background)
```typescript
// Source: micro-eth-signer docs + megaETH RPC docs
import { Transaction } from 'micro-eth-signer';
import { hexToBytes } from '@noble/hashes/utils.js';

async function handleSendTransaction(
  to: string,
  valueWei: string,
  accountIndex: number,
  network: 'mainnet' | 'testnet',
): Promise<{ txHash: string; explorerUrl: string }> {
  const session = await getSession();
  if (!session) throw new Error('Wallet is locked');

  const seed = hexToBytes(session.seed);
  const kp = deriveAccount(seed, accountIndex);
  const config = NETWORKS[network];

  // 1. Fetch nonce
  const nonce = BigInt(
    await rpcCall(network, 'eth_getTransactionCount', [kp.address, 'pending'])
  );

  // 2. Fetch fee parameters
  const baseFee = BigInt(await rpcCall(network, 'eth_gasPrice', []));
  const priorityFee = BigInt(
    await rpcCall(network, 'eth_maxPriorityFeePerGas', [])
  );
  const maxFeePerGas = baseFee + priorityFee;

  // 3. Estimate gas with buffer + floor
  const value = BigInt(valueWei);
  const rawGas = BigInt(
    await rpcCall(network, 'eth_estimateGas', [
      { from: kp.address, to, value: '0x' + value.toString(16) },
    ])
  );
  const buffered = rawGas + (rawGas * 20n) / 100n;
  const gasLimit = buffered > 60_000n ? buffered : 60_000n;

  // 4. Build + sign
  const tx = Transaction.prepare({
    to,
    value,
    nonce,
    gasLimit,
    maxFeePerGas,
    maxPriorityFeePerGas: priorityFee,
    chainId: config.chainId,
  });
  const signed = tx.signBy(kp.privateKey);
  const rawHex = '0x' + signed.toHex();

  // 5. Submit with realtime fallback
  try {
    const receipt = await rpcCall(network, 'realtime_sendRawTransaction', [rawHex]);
    const txHash = (receipt as any).transactionHash;
    return { txHash, explorerUrl: `${config.explorerUrl}/tx/${txHash}` };
  } catch (err) {
    if ((err as Error).message?.includes('realtime transaction expired')) {
      const txHash = await rpcCall(network, 'eth_sendRawTransaction', [rawHex]);
      return {
        txHash: txHash as string,
        explorerUrl: `${config.explorerUrl}/tx/${txHash}`,
      };
    }
    throw err;
  }
}
```

### CoinGecko Price Fetch with Cache
```typescript
// Source: CoinGecko API v3 docs
const COINGECKO_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd';
const PRICE_CACHE_MS = 60_000; // 1 minute cache

let cachedPrice: { usd: number; fetchedAt: number } | null = null;

async function getEthPrice(): Promise<number> {
  if (cachedPrice && Date.now() - cachedPrice.fetchedAt < PRICE_CACHE_MS) {
    return cachedPrice.usd;
  }
  const res = await fetch(COINGECKO_URL);
  const json = await res.json();
  const usd = json.ethereum.usd;
  cachedPrice = { usd, fetchedAt: Date.now() };
  return usd;
}
```

### Max Send Calculation
```typescript
// Calculate maximum sendable ETH after gas deduction
function calculateMaxSend(
  balanceWei: bigint,
  gasLimit: bigint,
  maxFeePerGas: bigint,
): bigint {
  const maxGasCost = gasLimit * maxFeePerGas;
  const maxSend = balanceWei - maxGasCost;
  return maxSend > 0n ? maxSend : 0n;
}
```

### Address Validation
```typescript
// Source: micro-eth-signer docs
import { addr } from 'micro-eth-signer';

function validateRecipient(input: string): { valid: boolean; error?: string } {
  if (!input.startsWith('0x')) return { valid: false, error: 'Address must start with 0x' };
  if (input.length !== 42) return { valid: false, error: 'Address must be 42 characters' };
  if (!addr.isValid(input)) return { valid: false, error: 'Invalid address checksum' };
  return { valid: true };
}
```

### ETH Formatting
```typescript
// Format wei to human-readable ETH with up to 4 significant decimals
function formatEth(wei: bigint): string {
  const eth = Number(wei) / 1e18;
  if (eth === 0) return '0';
  // Up to 4 significant decimal places, trim trailing zeros
  const str = eth.toFixed(18);
  const [integer, decimal] = str.split('.');
  if (!decimal) return integer;
  // Find first non-zero digit position, then show 4 significant digits
  const firstNonZero = decimal.search(/[1-9]/);
  if (firstNonZero === -1) return integer;
  const significantEnd = Math.min(firstNonZero + 4, decimal.length);
  const trimmed = decimal.slice(0, significantEnd).replace(/0+$/, '');
  return trimmed ? `${integer}.${trimmed}` : integer;
}

// Format USD with locale formatting
function formatUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ethers.js v5 (400KB+) | micro-eth-signer (1.87KB) + noble stack | 2023-2024 | 200x smaller bundle, same security guarantees |
| Legacy (Type 0) transactions | EIP-1559 (Type 2) transactions | London fork (2021) | Better fee predictability, base fee burning |
| `eth_sendRawTransaction` + poll | `realtime_sendRawTransaction` (megaETH-specific) | megaETH launch 2025 | Direct receipt return, no polling needed |
| ethers.js BigNumber | Native BigInt | ES2020+ | No library needed for large integer math |

**Deprecated/outdated:**
- `web3.js` v1: Replaced by v4, but still massive. Not recommended for extensions.
- `ethers.js` v5 `BigNumber`: Replaced by native BigInt in ethers v6. micro-eth-signer uses native BigInt throughout.
- `@ethereumjs/tx` v3: Requires many peer deps. v10 (2025) reduced deps but still heavier than micro-eth-signer.

## megaETH Network Configuration

| Property | Mainnet | Testnet |
|----------|---------|---------|
| Chain ID | 4326 | 6343 |
| RPC URL | https://mainnet.megaeth.com/rpc | https://carrot.megaeth.com/rpc |
| Block Explorer | https://mega.etherscan.io | https://megaeth-testnet-v2.blockscout.com |
| Base Fee | 0.001 gwei (10^6 wei) | 0.001 gwei (10^6 wei) |
| EIP-1559 Adjustment | Effectively disabled | Effectively disabled |
| Mini Block Time | ~10ms | ~10ms |
| EVM Block Time | ~1s | ~1s |
| Block Gas Limit | 10 billion | 10 billion |

**Key megaETH insight:** Base fee is static at 0.001 gwei. This means `maxFeePerGas` can be set to `baseFee + priorityFee` without worrying about base fee fluctuation. Still query `eth_gasPrice` and `eth_maxPriorityFeePerGas` from RPC for correctness.

## Open Questions

1. **micro-eth-signer `signBy()` input format**
   - What we know: API accepts `string | Uint8Array` for private key
   - What's unclear: Whether it expects hex string with or without `0x` prefix when string
   - Recommendation: Pass `Uint8Array` directly from `KeyPair.privateKey` (already Uint8Array in our codebase). Verify in implementation.

2. **micro-eth-signer `toHex()` output format**
   - What we know: Returns signed transaction as hex string
   - What's unclear: Whether return includes `0x` prefix or not
   - Recommendation: Check at implementation time; add `0x` prefix if missing before RPC submission.

3. **CoinGecko API stability for extension context**
   - What we know: Free tier, 30 calls/min, no CORS issues for fetch from background SW
   - What's unclear: Whether background SW `fetch()` to CoinGecko is affected by extension CSP
   - Recommendation: CSP `connect-src` in manifest.json must include `https://api.coingecko.com`. megaETH RPC URLs must also be added.

4. **Recent addresses storage limit**
   - What we know: Need to store previously sent-to addresses
   - What's unclear: Optimal limit
   - Recommendation: Store last 10 addresses in `chrome.storage.local` as `recentAddresses: Array<{address: string, timestamp: number}>`, sorted by most recent. Simple and sufficient for Phase 4.

## Sources

### Primary (HIGH confidence)
- `/paulmillr/micro-eth-signer` Context7 - Transaction API, RLP, signing, address validation, wei conversion
- `/paulmillr/noble-curves` Context7 - secp256k1 signing API, signature format
- `/paulmillr/noble-hashes` Context7 - keccak256, bytesToHex utilities
- [megaETH Realtime API docs](https://docs.megaeth.com/realtime-api) - realtime_sendRawTransaction method, timeout behavior, receipt format
- [megaETH RPC docs](https://docs.megaeth.com/rpc) - Supported RPC methods
- [megaETH Mainnet docs](https://docs.megaeth.com/frontier) - Chain ID 4326, RPC URL, base fee, block times
- [megaETH Testnet docs](https://docs.megaeth.com/testnet) - Chain ID 6343, RPC URL
- [EIP-1559 specification](https://eips.ethereum.org/EIPS/eip-1559) - Type 2 transaction format, signing scheme

### Secondary (MEDIUM confidence)
- [Ethereum.org RLP specification](https://ethereum.org/developers/docs/data-structures-and-encoding/rlp/) - RLP encoding rules
- [Ethereum.org Transactions docs](https://ethereum.org/developers/docs/transactions/) - Transaction format overview
- [CoinGecko API pricing](https://www.coingecko.com/en/api/pricing) - Free tier 30 calls/min, Demo API plan
- [ChainList megaETH](https://chainlist.org/chain/4326) - Chain ID confirmation
- [megaETH Blockscout explorer](https://megaeth.blockscout.com/) - Mainnet explorer URL format
- [mega.etherscan.io](https://mega.etherscan.io/) - Mainnet Etherscan explorer URL format

### Tertiary (LOW confidence)
- micro-eth-signer `toHex()` output prefix format - needs implementation-time verification
- CoinGecko extension CSP compatibility - needs manifest.json testing

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - micro-eth-signer is from same author as already-installed noble libs, well-documented, audited
- Architecture: HIGH - follows existing background SW message pattern, well-understood extension architecture
- Pitfalls: HIGH - documented from official megaETH docs (gas floor, realtime timeout) and common Ethereum development issues
- megaETH config: HIGH - chain IDs, RPC URLs, base fee all from official docs

**Research date:** 2026-03-01
**Valid until:** 2026-03-31 (stable -- megaETH network params unlikely to change rapidly)
