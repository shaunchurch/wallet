---
phase: 04-eth-transactions
plan: 02
subsystem: transactions
tags: [tdd, eip-1559, gas-floor, nonce, test-vectors, micro-eth-signer]

requires:
  - phase: 04-eth-transactions
    plan: 01
    provides: "buildAndSignTransaction, estimateGas, rpcCall, GAS_FLOOR"
provides:
  - "EIP-1559 Type 2 serialization tests with known-vector RLP match"
  - "Gas floor enforcement tests (6 cases, all >= 60k)"
  - "Sequential nonce correctness tests"
affects: []

tech-stack:
  added: []
  patterns: [vi.mock rpcCall, unsigned RLP known-vector, deterministic test keys]

key-files:
  created:
    - tests/tx/serialization.test.ts
    - tests/tx/gas.test.ts
    - tests/tx/nonce.test.ts
  modified: []

key-decisions:
  - "signBy uses extraEntropy by default; known-vector test compares unsigned RLP (deterministic) + verifies signature validity"
  - "Nonce logic tested via inline fetchNonce helper matching background.ts pattern (rpcCall + BigInt parse)"

duration: 4min
completed: 2026-03-01
---

# Phase 4 Plan 02: Transaction Correctness Tests Summary

**TDD tests for EIP-1559 serialization (5 cases incl known-vector unsigned RLP match), gas floor enforcement (6 cases all >= 60k), and sequential nonce correctness (5 cases)**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-01T22:14:29Z
- **Completed:** 2026-03-01T22:22:00Z
- **Tasks:** 1 (TDD RED+GREEN in single pass -- implementations already existed from 04-01)
- **Files created:** 3

## Accomplishments

- TEST-03: 5 EIP-1559 Type 2 serialization tests
  - 0x02 type prefix validation
  - Roundtrip sender recovery (2 different keys, varying field sizes)
  - Zero-value tx at 0xff nonce boundary
  - Known-vector: unsigned RLP byte-for-byte match against hardcoded hex + signature verification
- TEST-04: 6 gas estimation tests
  - 21000 -> 25200 (buffered) -> 60000 (floor)
  - 50000 -> 60000 (equals floor)
  - 100000 -> 120000 (above floor)
  - 0 -> 60000 (floor)
  - GAS_FLOOR constant = 60,000n
  - Sweep: 6 hex values all return >= 60,000
- TEST-06: 5 nonce correctness tests
  - 0x5 -> 5n, 0x0 -> 0n (hex parsing)
  - Sequential: nonce2 = nonce1 + 1
  - 0xff -> 255n (large value)
  - Correct RPC args: eth_getTransactionCount with "pending" tag

## Task Commits

1. **Task 1 (TDD RED+GREEN): All 3 test files** - `b981a86` (test)

## Files Created

- `tests/tx/serialization.test.ts` -- 5 EIP-1559 Type 2 serialization tests with known-vector
- `tests/tx/gas.test.ts` -- 6 gas floor enforcement tests, all assert >= 60,000
- `tests/tx/nonce.test.ts` -- 5 sequential nonce correctness tests

## Decisions Made

- signBy uses extra entropy (security default); known-vector compares unsigned RLP hex (deterministic) and verifies signature validity + sender recovery separately
- Nonce test uses inline fetchNonce helper matching background.ts pattern rather than importing from background (which has chrome dependencies)

## Deviations from Plan

None -- plan executed exactly as written.

## Test Results

All 120 tests pass (11 test files): 16 new tests added (5 serialization + 6 gas + 5 nonce).

---
*Phase: 04-eth-transactions*
*Completed: 2026-03-01*
