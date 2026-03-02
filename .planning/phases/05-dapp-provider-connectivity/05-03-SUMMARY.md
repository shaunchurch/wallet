---
phase: 05-dapp-provider-connectivity
plan: 03
subsystem: dapp-ui
tags: [dapp-connect, dapp-sign, dapp-confirm, connections, permit-warning, provider-isolation, eip-712, personal-sign]

# Dependency graph
requires:
  - phase: 05-dapp-provider-connectivity
    plan: 01
    provides: EIP-1193 provider, content relay, dapp types, connections CRUD
  - phase: 05-dapp-provider-connectivity
    plan: 02
    provides: pending request queue, approval handlers, signing, simulation
---

## Summary

Built all dapp UI screens + provider isolation test. 4 new screens: DappConnectScreen (account picker), DappSignScreen (personal_sign with hex decode + signTypedData_v4 with structured tree + Permit warnings), DappConfirmScreen (simulation + decoded calldata + editable gas), ConnectionsScreen (manage connected sites with disconnect/disconnect-all). ConnectionIndicator (green dot in header), eth_sign toggle in Advanced Settings.

## Tasks completed

| # | Task | Commit(s) |
|---|------|-----------|
| 1 | Store + App.tsx + Header + ConnectionIndicator + SettingsScreen | 78f7010 |
| 2 | DappConnect/Sign/Confirm/Connections screens | f8e3a47 |
| 3 | Provider isolation test (TEST-05) | a7f7eca |
| 4 | Visual verification (human-verify checkpoint) | approved |

## Post-checkpoint fixes

| Fix | Commit |
|-----|--------|
| Move provider mutable state to closures for Object.freeze compat | f71ee6e |
| Merge dapp:rpc into single listener, fix origin guard blocking relay | c9a4182 |
| Default to first account selected in dapp connect | 85caa81 |
| Truncate site title/origin in dapp screens | 96ceace |
| Slim header — dot-only connection indicator, drop globe | 41e2977 |

## Key files

### Created
- `src/features/ui/screens/DappConnectScreen.tsx` — connection approval with account picker
- `src/features/ui/screens/DappSignScreen.tsx` — personal_sign + signTypedData_v4 display with Permit warnings
- `src/features/ui/screens/DappConfirmScreen.tsx` — tx confirmation with simulation + editable gas
- `src/features/ui/screens/ConnectionsScreen.tsx` — connected sites management
- `src/features/ui/components/ConnectionIndicator.tsx` — green dot for connected dapps
- `tests/provider-isolation.test.ts` — TEST-05: no key material in dapp boundary

### Modified
- `src/features/wallet/store.ts` — dapp screen types, pendingDappRequest state, ethSignEnabled
- `src/features/ui/App.tsx` — routes to 4 new screens
- `src/features/ui/components/Header.tsx` — dapp screen headers, connection indicator
- `src/features/ui/screens/SettingsScreen.tsx` — Connected Sites link + Advanced eth_sign toggle
- `src/entrypoints/inpage.ts` — closure-based mutable state for frozen provider
- `src/entrypoints/background.ts` — single listener with dapp:rpc before origin guard
- `public/manifest.json` — tabs permission

## Deviations

1. Provider mutable state moved to closures (Object.freeze blocked class property mutations)
2. Merged two onMessage listeners into one (first listener's origin guard was silently dropping dapp:rpc)
3. Default to first account only in connect screen (not all accounts)
4. Connection indicator reduced to green dot only (text overflowed narrow header)
5. Removed connections globe button from header (accessible via Settings)

## Self-Check: PASSED
- [x] pnpm typecheck passes
- [x] pnpm lint passes
- [x] pnpm build succeeds
- [x] pnpm test passes (124/124)
- [x] Visual verification approved by user
