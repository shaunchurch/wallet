# Stack Research

**Domain:** Chrome Extension Crypto Wallet (megaETH L2)
**Researched:** 2026-03-01
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| TypeScript | 5.9.3 | Type safety across all contexts | Stable release. TS 6.0 in beta — skip until stable. Exact types for tx serialization, ABI encoding, chain config prevent runtime errors that lose funds. |
| React | 19.2.4 | Popup/options UI | Stable, mature extension ecosystem. ~40KB gzipped for popup — acceptable for wallet UX needs (confirmation dialogs, token lists, settings). |
| react-dom | 19.2.4 | DOM rendering | Must match React version exactly. |
| viem | 2.46.2 | Ethereum interaction | First-class TypeScript, tree-shakeable (use only what you import), built-in EIP-7702 support (`signAuthorization`, `authorizationList`), `defineChain` for custom megaETH config. Much smaller bundle than ethers.js when tree-shaken. |
| esbuild | 0.27.3 | Bundler | Sub-100ms builds, native multi-entry support, zero config for separate bundles per extension context (background, popup, content). No plugin ecosystem overhead of webpack/vite. |
| Zustand | 5.0.11 | State management | 1.2KB gzipped, works outside React (background service worker), `persist` middleware with custom storage adapters for `chrome.storage.local`, no boilerplate. |
| Tailwind CSS | 4.2.1 | Styling | Utility-first, zero runtime CSS, compiles to static stylesheet — no CSP violations. v4 is CSS-first config (no tailwind.config.js). |

### Cryptography (Zero-Dependency)

| Library | Version | Purpose | Why Recommended |
|---------|---------|---------|-----------------|
| @noble/curves | 2.0.1 | secp256k1 signing, ECDSA | Audited, zero-dep, 5KB. Author: Paul Miller (also maintains viem's crypto). Used by MetaMask, Phantom, Rainbow. |
| @noble/hashes | 2.0.1 | SHA-256, Keccak-256, HMAC, PBKDF2 | Same author/audit lineage. Needed for address derivation, key stretching. |
| @scure/bip39 | 2.0.1 | Mnemonic generation/validation | Audited BIP-39 implementation using noble-hashes. Zero deps. |
| @scure/bip32 | 2.0.1 | HD key derivation (BIP-44 paths) | Audited BIP-32 over secp256k1. Derives m/44'/60'/0'/0/N paths for Ethereum accounts. |

### Extension Infrastructure

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| webext-zustand | 1.x (latest) | Cross-context state sync | Wraps Zustand stores for background <-> popup <-> content script communication via `chrome.runtime` ports. Handles service worker restarts. |
| @radix-ui/react-* | latest | Accessible UI primitives | Used by shadcn/ui. Import individual components (dialog, dropdown, tooltip) — not the full library. |
| tailwind-merge | latest | Class deduplication | Required by shadcn/ui pattern for `cn()` utility. |
| clsx | latest | Conditional classes | Required by shadcn/ui pattern for `cn()` utility. |
| lucide-react | latest | Icons | Tree-shakeable SVG icons, used by shadcn/ui. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| vitest | Unit/integration testing | Fast, esbuild-powered, native TypeScript. Use for crypto ops, tx serialization, state logic. |
| @testing-library/react | Component testing | Test popup UI interactions (confirm tx, enter password). |
| web-ext | Extension loading/testing | Mozilla tool, works for Chrome dev. Auto-reload on build. |
| prettier | Formatting | Consistent code style. |
| eslint | Linting | Catch errors before they ship. Use `@typescript-eslint`. |

## megaETH-Specific Configuration

### Chain Definitions (viem)

```typescript
import { defineChain } from 'viem'

export const megaeth = defineChain({
  id: 4326,
  name: 'MegaETH',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: {
      http: ['https://mainnet.megaeth.com/rpc'],
      webSocket: ['wss://megaeth.drpc.org'],
    },
  },
  blockExplorers: {
    default: { name: 'MegaETH Explorer', url: 'https://megaeth.blockscout.com' },
    etherscan: { name: 'MegaETH Etherscan', url: 'https://mega.etherscan.com' },
  },
})

export const megaethTestnet = defineChain({
  id: 6343,
  name: 'MegaETH Testnet',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: {
      http: ['https://carrot.megaeth.com/rpc'],
      webSocket: ['wss://carrot.megaeth.com/ws'],
    },
  },
  blockExplorers: {
    default: { name: 'MegaETH Testnet', url: 'https://megaeth-testnet-v2.blockscout.com' },
  },
  testnet: true,
})
```

### megaETH Gas Model

megaETH uses **multidimensional gas**: compute gas (standard EVM) + storage gas (new).

- **Minimum tx gas: 60,000** (21k compute + 39k storage) — NOT Ethereum's 21,000
- Base fee: 0.001 gwei (effectively zero, EIP-1559 adjustment disabled)
- Gas forwarding: 98/100 rule (not Ethereum's 63/64)
- **Critical:** Do NOT use local gas estimation. Always use megaETH RPC (`eth_estimateGas`) or hardcode minimum 60,000.

### megaETH Realtime API

WebSocket subscriptions for real-time state:

```typescript
// Subscribe to balance changes
{ "jsonrpc": "2.0", "method": "eth_subscribe",
  "params": ["stateChanges", ["0xADDRESS"]], "id": 83 }

// Response: { address, nonce, balance, storage: { slot: value } }
```

- **Keepalive:** Send `eth_chainId` every 30 seconds or connection drops
- **realtime_sendRawTransaction:** Returns receipt directly (no polling), 10s timeout
- **Fallback:** If timeout, poll `eth_getTransactionReceipt`

### EIP-7702 via viem

```typescript
const authorization = await walletClient.signAuthorization({
  account: eoa,
  contractAddress: batcherContract,
})

const hash = await walletClient.sendTransaction({
  authorizationList: [authorization],
  data: encodeFunctionData({ abi, functionName: 'executeBatch', args: [calls] }),
  to: eoa.address,
})
```

**Status:** viem has full EIP-7702 support. megaETH's Rex3 hardfork is based on Optimism Isthmus / Ethereum Prague — EIP-7702 support depends on megaETH's hardfork timeline. **LOW confidence** on megaETH EIP-7702 availability at launch. Architect the signing interface to support it, but don't block MVP on it.

## esbuild Configuration (Extension Build)

```typescript
// build.mjs
import * as esbuild from 'esbuild'

const common = {
  bundle: true,
  sourcemap: process.env.NODE_ENV !== 'production',
  target: ['chrome120'],
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
  },
  minify: process.env.NODE_ENV === 'production',
}

// Background service worker (no DOM)
await esbuild.build({
  ...common,
  entryPoints: { background: 'src/background/index.ts' },
  outdir: 'dist',
  format: 'esm',
})

// Popup (React app)
await esbuild.build({
  ...common,
  entryPoints: { popup: 'src/popup/index.tsx' },
  outdir: 'dist',
  format: 'iife',
  loader: { '.css': 'css' },
})

// Content script (injected into pages)
await esbuild.build({
  ...common,
  entryPoints: { 'content-script': 'src/content/index.ts' },
  outdir: 'dist',
  format: 'iife', // Must be IIFE — content scripts can't use ESM
})

// Inpage script (EIP-1193 provider, injected into page world)
await esbuild.build({
  ...common,
  entryPoints: { inpage: 'src/inpage/index.ts' },
  outdir: 'dist',
  format: 'iife',
})
```

**Key points:**
- Separate builds per context — no shared chunks between background/popup/content (different execution environments)
- Content scripts MUST be IIFE (Chrome doesn't support ESM in content scripts)
- Background service worker can be ESM (`"type": "module"` in manifest)

## Manifest V3 Essentials

```json
{
  "manifest_version": 3,
  "name": "Vibe Wallet",
  "version": "0.1.0",
  "action": { "default_popup": "popup.html" },
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["content-script.js"],
    "run_at": "document_start"
  }],
  "permissions": ["storage", "activeTab"],
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  }
}
```

**MV3 constraints:**
- No `eval()`, `new Function()`, dynamic `import()` from remote — this is fine, wallet should never do these
- Service worker terminates after 30s idle (extended by active WebSocket since Chrome 116)
- No persistent background page — all state must persist to `chrome.storage.local`
- Remote code execution banned — all code must ship in the extension package

## Zustand + chrome.storage Pattern

```typescript
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

const chromeStorage = {
  getItem: async (key: string) => {
    const result = await chrome.storage.local.get(key)
    return result[key] ?? null
  },
  setItem: async (key: string, value: string) => {
    await chrome.storage.local.set({ [key]: value })
  },
  removeItem: async (key: string) => {
    await chrome.storage.local.remove(key)
  },
}

export const useWalletStore = create(
  persist(
    (set) => ({
      accounts: [],
      activeAccount: null,
      // ... wallet state (NEVER store decrypted keys here)
    }),
    {
      name: 'wallet-state',
      storage: createJSONStorage(() => chromeStorage),
      partialize: (state) => ({
        accounts: state.accounts, // public data only
        activeAccount: state.activeAccount,
      }),
    }
  )
)
```

**Critical:** Encrypted vault (seed, private keys) uses separate `chrome.storage.local` key with AES-256-GCM encryption. Never pass through Zustand persist — handle in dedicated crypto module.

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| esbuild | WXT (Vite) | WXT is excellent but adds framework abstraction. For a security-critical wallet, direct esbuild control means auditable build output, no hidden transforms, deterministic builds. WXT's HMR is nice but not worth the dependency surface. |
| esbuild | webpack | 10-100x slower builds, complex config, massive dependency tree — attack surface concern for wallet. |
| viem | ethers.js v6 | ethers.js is larger (even tree-shaken), less TypeScript-native, no built-in EIP-7702 helpers. viem is the standard for new Ethereum projects 2024+. |
| Zustand | Redux/Redux Toolkit | Redux is 5-10x more boilerplate, heavier, and the toolkit pulls in immer. Zustand's 1.2KB + works outside React (background worker). |
| Zustand | Jotai | Jotai is atom-based (bottom-up), harder to sync across extension contexts. Zustand's single-store model maps cleanly to chrome.storage. |
| @noble/@scure | ethers.js crypto | ethers bundles its own crypto — can't audit separately, larger bundle, more deps. Noble/scure are standalone, audited, zero-dep. |
| Tailwind CSS | CSS Modules | Tailwind compiles to static CSS (CSP-safe), faster iteration, consistent with shadcn/ui. CSS Modules work but slower development. |
| Tailwind CSS | styled-components | Runtime CSS-in-JS violates extension CSP (`style-src` restrictions). Banned. |
| React 19 | Preact | Preact is smaller (~3KB) but ecosystem gaps with shadcn/ui, Radix. React's ~40KB is acceptable for popup context. |
| webext-zustand | @webext-pegasus/store-zustand | Pegasus is more feature-rich but heavier dependency. webext-zustand is simpler, directly built for this use case. Evaluate both — **MEDIUM confidence.** |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| ethers.js | Larger bundle, weaker TypeScript, no tree-shaking for crypto, no EIP-7702 helpers | viem 2.x |
| webpack | Slow, complex, massive dep tree — supply chain risk | esbuild |
| web3.js | Deprecated pattern, poor TypeScript, enormous bundle | viem |
| styled-components / emotion | Runtime CSS injection violates MV3 CSP | Tailwind CSS |
| Redux | Excessive boilerplate, large bundle, immer dependency | Zustand |
| Plasmo framework | Uses Parcel (2-3x slower than Vite/esbuild), opinionated structure limits control over security-critical build | esbuild (direct) |
| crypto-js | Unmaintained, not audited, unnecessary when noble/scure exist | @noble/hashes |
| node-forge | Heavy, not browser-native, poor tree-shaking | @noble/hashes |
| Buffer polyfill | Large, unnecessary — use Uint8Array natively | Native Uint8Array + viem utilities |
| `eval()` / `new Function()` | Banned by MV3 CSP, security antipattern | Static code only |

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| viem@2.46.x | TypeScript 5.9.x | viem requires TS 5.0.4+, strict mode recommended |
| viem@2.46.x | @noble/curves@2.x, @noble/hashes@2.x | viem uses noble internally — version alignment prevents duplicate bundles |
| zustand@5.x | React 18+ / React 19 | Zustand 5 dropped React 17 support |
| tailwindcss@4.x | esbuild (via PostCSS) | Tailwind v4 uses Lightning CSS engine, works with esbuild CSS loader |
| @scure/bip32@2.x | @noble/curves@2.x, @noble/hashes@2.x | scure-bip32 2.x requires noble 2.x (breaking change from 1.x) |
| esbuild@0.27.x | TypeScript 5.x | esbuild strips types (no type checking) — run `tsc --noEmit` separately |

## Installation

```bash
# Core
npm install react@19.2.4 react-dom@19.2.4 viem@2.46.2 zustand@5.0.11

# Crypto (zero-dep, audited)
npm install @noble/curves@2.0.1 @noble/hashes@2.0.1 @scure/bip39@2.0.1 @scure/bip32@2.0.1

# UI (shadcn/ui pattern — components are copy-pasted, not installed as package)
npm install tailwindcss@4.2.1 tailwind-merge clsx lucide-react
npm install @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-tooltip

# Extension state sync
npm install webext-zustand

# Dev dependencies
npm install -D typescript@5.9.3 esbuild@0.27.3 @types/react @types/react-dom @types/chrome
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
npm install -D prettier eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser
npm install -D web-ext
```

**Pin all versions exactly** — no `^` or `~`. Use `npm install --save-exact` or set `save-exact=true` in `.npmrc`.

## Sources

- [viem docs — defineChain](https://viem.sh/docs/chains/introduction) (Context7 /wevm/viem) — HIGH confidence
- [viem docs — EIP-7702](https://viem.sh/docs/eip7702) (Context7 /wevm/viem) — HIGH confidence
- [Zustand persist middleware](https://zustand.docs.pmnd.rs/) (Context7 /pmndrs/zustand) — HIGH confidence
- [esbuild API — multiple entry points](https://esbuild.github.io/api/) (Context7 /evanw/esbuild) — HIGH confidence
- [megaETH Realtime API](https://docs.megaeth.com/realtime-api) — HIGH confidence
- [megaETH MegaEVM gas model](https://docs.megaeth.com/megaevm) — HIGH confidence
- [megaETH mainnet config](https://docs.megaeth.com/frontier) — HIGH confidence
- [megaETH testnet config](https://chainlist.org/chain/6343) — HIGH confidence
- [megaETH mainnet endpoints](https://chainlist.org/chain/4326) — HIGH confidence
- [Chrome MV3 service worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) — HIGH confidence
- [Chrome MV3 migration guide](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3) — HIGH confidence
- [webext-zustand](https://github.com/sinanbekar/webext-zustand) — MEDIUM confidence (evaluate vs pegasus at implementation time)
- [Noble cryptography](https://paulmillr.com/noble/) — HIGH confidence
- [WXT framework comparison](https://redreamality.com/blog/the-2025-state-of-browser-extension-frameworks-a-comparative-analysis-of-plasmo-wxt-and-crxjs/) — MEDIUM confidence (WebSearch only)
- [npm package versions](https://www.npmjs.com/) — HIGH confidence (verified Feb/Mar 2026)

---
*Stack research for: Chrome Extension Crypto Wallet (megaETH L2)*
*Researched: 2026-03-01*
