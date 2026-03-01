# Phase 1: Build & Extension Scaffold - Research

**Researched:** 2026-03-01
**Domain:** Chrome MV3 extension build pipeline (esbuild, React, Tailwind, CSP)
**Confidence:** HIGH

## Summary

Phase 1 is a greenfield Chrome MV3 extension scaffold with a multi-bundle esbuild pipeline, strict CSP, and deterministic builds. The core challenge is that esbuild's `splitting` only works with ESM format, so the four entrypoints (background ESM, content IIFE, popup HTML+JS, inpage IIFE) require multiple `esbuild.build()` calls with different configurations. Tailwind CSS v4 uses `@tailwindcss/postcss` as a PostCSS plugin, requiring an esbuild PostCSS plugin for CSS processing. shadcn/ui components are copy-pasted into the project (not a dependency) and work with Tailwind v4's CSS-based configuration.

esbuild is inherently deterministic for same inputs -- no timestamps or randomness in output. The main threats to reproducibility are: non-pinned dependencies changing between installs, and environment-dependent values leaking into `define` replacements. Pinning via `save-exact=true` in `.npmrc` + `pnpm install --frozen-lockfile` in CI covers the dependency side.

**Primary recommendation:** Build a `scripts/build.ts` that runs 3 separate `esbuild.build()` calls (background ESM, popup bundle, content+inpage IIFE), copies static assets (manifest.json, popup.html, icons) to `dist/`, and verifies byte-identical output via sha256 hash comparison in a test.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- React 19 (latest stable)
- Zustand for state management
- shadcn/ui components (copy-paste, Radix-based, ownable)
- React Router with MemoryRouter for popup navigation
- Maximum TypeScript strictness (strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes)
- Chrome-only target (Chromium browsers get it free; Firefox deferred)
- Typed wrappers around chrome.runtime messaging (no library deps)
- Tailwind CSS (pairs with shadcn/ui)
- Light + dark mode toggle (not dark-only)
- Monochrome palette + purple/violet accent
- 360x600 popup dimensions (industry standard)
- Styled skeleton previewing eventual layout (header bar, balance area, action buttons -- all placeholder)
- Placeholder text logo/SVG icon (no brand assets yet)
- Extension name: "megawallet" (lowercase)
- Manifest description: "The fastest wallet for the fastest chain"
- Feature-based layout: src/features/ + src/entrypoints/
- Entrypoints: background.ts, content.ts, popup.tsx, inpage.ts
- Features: wallet/, network/, ui/ (grow as phases add capabilities)
- pnpm package manager (exact version pins, strict resolution)
- Vitest for testing
- Biome for linting + formatting (single tool, Rust-based)

### Claude's Discretion
- esbuild configuration details and plugin choices
- CSP policy specifics beyond the requirements
- Deterministic build implementation approach
- Placeholder skeleton exact layout and spacing
- Placeholder SVG icon design
- Tailwind theme configuration details
- shadcn/ui component selection for scaffold

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BUILD-01 | Manifest V3 extension with strict CSP (no inline scripts, no remote loading) | MV3 manifest structure documented; default CSP (`script-src 'self'; object-src 'self'`) already blocks inline/remote; explicit CSP in manifest reinforces |
| BUILD-02 | esbuild produces separate bundles for background, content script, popup, inpage | Multiple `esbuild.build()` calls with different `format` options (ESM for background, IIFE for content/inpage); popup bundled separately with JSX |
| BUILD-03 | Exact version pins in package.json (no ^ or ~) | `.npmrc` with `save-exact=true`; pnpm enforces; CI script can grep for `[\^~]` in package.json |
| BUILD-04 | Deterministic/reproducible build output | esbuild is deterministic for same inputs; pin deps, avoid timestamps in `define`, use `--metafile` for verification; sha256 comparison test |
| BUILD-05 | No eval(), Function(), or dynamic import() from remote sources | CSP blocks eval/Function; esbuild tree-shakes; Biome lint rule `noGlobalEval`; build-time grep verification |
| BUILD-06 | Lockfile integrity verified in CI | `pnpm install --frozen-lockfile` fails if lockfile doesn't match package.json |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| esbuild | 0.27.3 | Bundler | Fastest JS bundler; deterministic output; native ESM/IIFE support; Chrome extension community standard |
| react | 19.2.4 | UI framework | User decision; latest stable |
| react-dom | 19.2.4 | React DOM renderer | Pairs with React |
| react-router | 7.x | Popup routing | User decision; MemoryRouter for popup navigation (no browser URL bar) |
| zustand | 5.0.11 | State management | User decision; minimal API, no boilerplate |
| tailwindcss | 4.2.1 | Utility CSS | User decision; v4 uses CSS-based config (no tailwind.config.js) |
| @tailwindcss/postcss | 0.x | PostCSS plugin for Tailwind v4 | Required bridge between esbuild and Tailwind v4 processing |
| postcss | 8.x | CSS processing | Dependency of @tailwindcss/postcss |
| typescript | 5.x | Type checking | User decision; maximum strictness |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @biomejs/biome | 2.4.4 | Linting + formatting | User decision; replaces ESLint+Prettier |
| vitest | 3.x | Testing | User decision; fast Vite-native test runner |
| @radix-ui/react-* | latest | Accessible primitives | Required by shadcn/ui components (installed per-component) |
| lucide-react | latest | Icons | Default icon library for shadcn/ui |
| class-variance-authority | latest | Component variants | shadcn/ui dependency for variant styling |
| clsx | latest | Class merging | shadcn/ui utility |
| tailwind-merge | latest | Tailwind class dedup | shadcn/ui utility (cn() helper) |
| @types/chrome | latest | Chrome API types | Type definitions for chrome.* APIs |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| esbuild (direct) | WXT / Plasmo | Higher-level extension frameworks; more magic, less control over bundle boundaries; user chose raw esbuild |
| esbuild PostCSS plugin | Tailwind CLI subprocess | Simpler but adds process coordination; inline plugin is more integrated |
| react-router MemoryRouter | Manual state-based routing | MemoryRouter gives standard route patterns; note: v7 docs say MemoryRouter is "primarily for testing" but it works fine for popup UIs without a URL bar |

**Installation:**
```bash
pnpm add react react-dom react-router zustand
pnpm add -D esbuild typescript tailwindcss @tailwindcss/postcss postcss @biomejs/biome vitest @types/chrome @types/react @types/react-dom
```

shadcn/ui components are added individually via `npx shadcn@latest add <component>` (copies source into project).

## Architecture Patterns

### Recommended Project Structure
```
megawallet/
├── .npmrc                    # save-exact=true
├── biome.json                # Biome config
├── components.json           # shadcn/ui config
├── tsconfig.json             # Strict TS config
├── vitest.config.ts          # Vitest config
├── scripts/
│   └── build.ts              # esbuild build script
├── public/
│   ├── manifest.json         # MV3 manifest (copied to dist)
│   ├── popup.html            # Popup HTML shell (copied to dist)
│   └── icons/                # Extension icons (16/32/48/128)
├── src/
│   ├── entrypoints/
│   │   ├── background.ts     # Service worker (ESM)
│   │   ├── content.ts        # Content script (IIFE, ISOLATED world)
│   │   ├── inpage.ts         # Injected into MAIN world (IIFE)
│   │   └── popup.tsx         # Popup React app entry
│   ├── components/
│   │   └── ui/               # shadcn/ui components (copied here)
│   ├── features/
│   │   ├── wallet/           # (empty in Phase 1)
│   │   ├── network/          # (empty in Phase 1)
│   │   └── ui/               # Theme, layout, placeholder components
│   ├── lib/
│   │   └── utils.ts          # cn() helper for shadcn/ui
│   └── styles/
│       └── globals.css        # @import "tailwindcss"; theme config
├── dist/                     # Build output (gitignored)
└── tests/
    └── build.test.ts         # Deterministic build verification
```

### Pattern 1: Multi-Call esbuild Build Script
**What:** Separate `esbuild.build()` calls for each output format requirement
**When to use:** Always -- esbuild `splitting` only works with `format: 'esm'`, so IIFE bundles need separate build calls
**Example:**
```typescript
// scripts/build.ts
import * as esbuild from 'esbuild';
import { postcssPlugin } from './postcss-plugin';

const common: esbuild.BuildOptions = {
  bundle: true,
  minify: process.env.NODE_ENV === 'production',
  sourcemap: process.env.NODE_ENV !== 'production',
  target: ['chrome120'],
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'development'),
  },
  logLevel: 'info',
};

// Background service worker -- ESM (supports top-level await)
await esbuild.build({
  ...common,
  entryPoints: ['src/entrypoints/background.ts'],
  outfile: 'dist/background.js',
  format: 'esm',
});

// Content script -- IIFE (runs in ISOLATED world)
await esbuild.build({
  ...common,
  entryPoints: ['src/entrypoints/content.ts'],
  outfile: 'dist/content.js',
  format: 'iife',
});

// Inpage script -- IIFE (injected into MAIN world)
await esbuild.build({
  ...common,
  entryPoints: ['src/entrypoints/inpage.ts'],
  outfile: 'dist/inpage.js',
  format: 'iife',
});

// Popup -- ESM (loaded by popup.html <script type="module">)
await esbuild.build({
  ...common,
  entryPoints: ['src/entrypoints/popup.tsx'],
  outfile: 'dist/popup.js',
  format: 'esm',
  plugins: [postcssPlugin()],
  loader: { '.tsx': 'tsx', '.ts': 'ts', '.svg': 'dataurl' },
});
```

### Pattern 2: MV3 Manifest with Inpage Injection
**What:** Content script in ISOLATED world + inpage script in MAIN world via `web_accessible_resources`
**When to use:** Wallet extensions that need `window.ethereum` provider
**Example:**
```json
{
  "manifest_version": 3,
  "name": "megawallet",
  "version": "0.1.0",
  "description": "The fastest wallet for the fastest chain",
  "permissions": ["storage", "activeTab"],
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "action": {
    "default_popup": "popup.html",
    "default_title": "megawallet"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"],
      "run_at": "document_start",
      "world": "ISOLATED"
    }
  ],
  "web_accessible_resources": [
    {
      "resources": ["inpage.js"],
      "matches": ["<all_urls>"]
    }
  ],
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self';"
  }
}
```

### Pattern 3: Content Script Injects Inpage
**What:** Content script creates a `<script>` tag pointing to `inpage.js` via `chrome.runtime.getURL()`
**When to use:** To inject the EIP-1193 provider into the page's MAIN world
**Example:**
```typescript
// src/entrypoints/content.ts
const script = document.createElement('script');
script.src = chrome.runtime.getURL('inpage.js');
script.type = 'text/javascript';
(document.head || document.documentElement).appendChild(script);
script.onload = () => script.remove();
```

Note: Alternative approach uses `"world": "MAIN"` in manifest content_scripts directly, but the injection pattern gives more control over timing and is the standard wallet pattern (MetaMask, Rabby use this).

### Pattern 4: esbuild PostCSS Plugin for Tailwind v4
**What:** Lightweight esbuild plugin that processes `.css` files through PostCSS with `@tailwindcss/postcss`
**When to use:** Every build -- required for Tailwind v4 class processing
**Example:**
```typescript
// scripts/postcss-plugin.ts
import { readFile } from 'node:fs/promises';
import postcss from 'postcss';
import tailwindcss from '@tailwindcss/postcss';

export function postcssPlugin(): esbuild.Plugin {
  return {
    name: 'postcss',
    setup(build) {
      build.onLoad({ filter: /\.css$/ }, async (args) => {
        const css = await readFile(args.path, 'utf-8');
        const result = await postcss([tailwindcss()]).process(css, {
          from: args.path,
        });
        return { contents: result.css, loader: 'css' };
      });
    },
  };
}
```

### Pattern 5: Tailwind v4 CSS-Based Configuration
**What:** Tailwind v4 moves all config into CSS -- no `tailwind.config.js`
**When to use:** Always with Tailwind v4
**Example:**
```css
/* src/styles/globals.css */
@import "tailwindcss";

@theme {
  --color-accent: oklch(0.541 0.281 293.009); /* purple/violet */
  --font-sans: "Inter", system-ui, sans-serif;
}
```

### Anti-Patterns to Avoid
- **Single esbuild.build() with splitting for all entrypoints:** Splitting only works with ESM format; content scripts and inpage MUST be IIFE to avoid module scope issues in page context
- **Using `tailwindcss` directly as PostCSS plugin:** v4 moved the PostCSS plugin to `@tailwindcss/postcss`; using `tailwindcss` directly throws an error
- **Inline scripts in popup.html:** Violates CSP. All JS must be in separate files loaded via `<script src="...">`
- **Using `eval()` or `new Function()` anywhere:** Blocked by CSP; also violates BUILD-05
- **Non-exact version specifiers:** Every dependency MUST be exact (e.g., `"19.2.4"` not `"^19.2.4"`)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSS utility framework | Custom CSS utilities | Tailwind CSS v4 | Thousands of edge cases in responsive, dark mode, etc. |
| Component primitives | Custom accessible components | shadcn/ui + Radix UI | Accessibility (ARIA) is extremely hard to get right |
| Class name merging | String concatenation | `clsx` + `tailwind-merge` (via `cn()`) | Tailwind class conflicts need intelligent dedup |
| Linting + formatting | ESLint + Prettier config | Biome | Single tool, zero config conflicts, faster |
| Chrome API types | Manual type declarations | @types/chrome | Comprehensive, community-maintained |

**Key insight:** The build script itself is simple enough to hand-roll (3-4 esbuild.build calls + file copies). Don't introduce a framework (WXT, Plasmo) for what amounts to ~80 lines of build code.

## Common Pitfalls

### Pitfall 1: CSP Violations from React/JSX
**What goes wrong:** React's development mode or certain JSX patterns can trigger CSP violations in extensions
**Why it happens:** Some React dev tools inject inline scripts; development error overlays use `eval()`
**How to avoid:** Always use production React in the extension (`process.env.NODE_ENV: '"production"'`); test with DevTools Console open to catch violations
**Warning signs:** Console errors mentioning `Content-Security-Policy` or `unsafe-eval`

### Pitfall 2: Content Script Module Scope Leak
**What goes wrong:** Using ESM format for content/inpage scripts causes `import` statements that Chrome can't resolve
**Why it happens:** Content scripts and MAIN-world scripts don't have module resolution; they execute as plain scripts
**How to avoid:** Bundle content.ts and inpage.ts as `format: 'iife'` so all dependencies are inlined
**Warning signs:** `Uncaught SyntaxError: Cannot use import statement outside a module`

### Pitfall 3: Non-Deterministic Build from Environment Leaks
**What goes wrong:** Builds differ between machines due to `__dirname`, timestamps, or env vars in `define`
**Why it happens:** esbuild's `define` replaces constants at build time; if values include host-specific paths, output changes
**How to avoid:** Only use static string values in `define` (e.g., `'"production"'`, `'"0.1.0"'`); never include `Date.now()`, `__dirname`, or file paths
**Warning signs:** SHA-256 hash comparison fails between two consecutive builds

### Pitfall 4: Tailwind v4 PostCSS Plugin Mismatch
**What goes wrong:** `Error: It looks like you're trying to use 'tailwindcss' directly as a PostCSS plugin`
**Why it happens:** Tailwind v4 moved the PostCSS plugin to `@tailwindcss/postcss`; the main package no longer exports a PostCSS plugin
**How to avoid:** Import from `@tailwindcss/postcss`, not `tailwindcss`
**Warning signs:** Build fails immediately with the error above

### Pitfall 5: shadcn/ui Setup Without Vite
**What goes wrong:** `npx shadcn@latest init` assumes Vite or Next.js; fails or generates wrong config for custom esbuild setup
**Why it happens:** shadcn CLI auto-detects framework; esbuild projects aren't detected
**How to avoid:** Create `components.json` manually with correct aliases; use `npx shadcn@latest add <component>` for individual components after manual setup
**Warning signs:** CLI errors about missing vite.config or next.config

### Pitfall 6: Service Worker Termination
**What goes wrong:** Background service worker terminates after 5 minutes of inactivity; state is lost
**Why it happens:** MV3 service workers are ephemeral by design (unlike MV2 persistent background pages)
**How to avoid:** Phase 1 only: keep background.ts minimal (just a placeholder log). Real state management (Phase 2+) uses `chrome.storage.session`
**Warning signs:** `console.log` in background.ts stops appearing in service worker DevTools

## Code Examples

### popup.html (CSP-Compliant)
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=360" />
  <link rel="stylesheet" href="popup.css" />
</head>
<body>
  <div id="root"></div>
  <script type="module" src="popup.js"></script>
</body>
</html>
```

### popup.tsx (React Entry)
```typescript
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { App } from '../features/ui/App';
import '../styles/globals.css';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <MemoryRouter>
        <App />
      </MemoryRouter>
    </StrictMode>
  );
}
```

### background.ts (Minimal Scaffold)
```typescript
// MV3 service worker -- placeholder for Phase 1
console.log('[megawallet] background service worker started');

// Keep alive for debugging (Phase 1 only)
chrome.runtime.onInstalled.addListener(() => {
  console.log('[megawallet] extension installed');
});
```

### tsconfig.json (Maximum Strictness)
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noEmit": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### biome.json (Base Config)
```json
{
  "$schema": "https://biomejs.dev/schemas/2.4.2/schema.json",
  "root": true,
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "useIgnoreFile": true,
    "defaultBranch": "main"
  },
  "files": {
    "includes": ["src/**/*.ts", "src/**/*.tsx", "scripts/**/*.ts", "tests/**/*.ts"],
    "ignore": ["dist/**", "node_modules/**"]
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100,
    "lineEnding": "lf"
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "correctness": {
        "noUnusedVariables": "error",
        "noUnusedImports": "error"
      },
      "suspicious": {
        "noExplicitAny": "warn"
      },
      "security": {
        "noGlobalEval": "error"
      }
    }
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "trailingCommas": "all",
      "semicolons": "always"
    }
  },
  "overrides": [
    {
      "include": ["*.config.ts", "scripts/**"],
      "linter": {
        "rules": {
          "style": {
            "noDefaultExport": "off"
          }
        }
      }
    }
  ]
}
```

### .npmrc (Exact Pinning)
```ini
save-exact=true
auto-install-peers=true
strict-peer-dependencies=false
```

### Deterministic Build Verification Test
```typescript
// tests/build.test.ts
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function hashDir(dir: string): string {
  const hash = createHash('sha256');
  const files = readdirSync(dir).sort();
  for (const file of files) {
    const path = join(dir, file);
    if (statSync(path).isDirectory()) {
      hash.update(hashDir(path));
    } else {
      hash.update(readFileSync(path));
    }
  }
  return hash.digest('hex');
}

describe('deterministic build', () => {
  it('produces identical output for consecutive builds', () => {
    execSync('pnpm build', { env: { ...process.env, NODE_ENV: 'production' } });
    const hash1 = hashDir('dist');
    execSync('pnpm build', { env: { ...process.env, NODE_ENV: 'production' } });
    const hash2 = hashDir('dist');
    expect(hash1).toBe(hash2);
  });
});
```

### Version Pin Verification Test
```typescript
// tests/pins.test.ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('version pinning', () => {
  it('package.json has no ^ or ~ version specifiers', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf-8'));
    const allDeps = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
    };
    for (const [name, version] of Object.entries(allDeps)) {
      expect(version, `${name} has unpinned version: ${version}`).not.toMatch(/^[\^~]/);
    }
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| MV2 persistent background page | MV3 service worker (ephemeral) | Chrome 88 (2021), MV2 sunset 2024 | Must use `chrome.storage` for persistence; no long-lived connections |
| tailwind.config.js | Tailwind v4 CSS-based @theme config | Jan 2025 | No JS config file; all customization in CSS |
| ESLint + Prettier | Biome 2.x | 2024-2025 | Single binary, 100x faster, no config conflicts |
| tailwindcss as PostCSS plugin | @tailwindcss/postcss | Tailwind v4 (Jan 2025) | Must use separate package for PostCSS integration |
| MV2 content script injection | MV3 `world: "MAIN"` in manifest or `chrome.scripting.executeScript` | Chrome 102 | Native MAIN world support; but injection pattern still preferred for wallets |

**Deprecated/outdated:**
- `tailwindcss` as direct PostCSS plugin: v4 requires `@tailwindcss/postcss`
- `postcss-import` / `autoprefixer` with Tailwind: v4 handles both internally
- `tailwind.config.js`: v4 uses `@theme` in CSS
- `background.scripts` in manifest: MV3 uses `background.service_worker` (string, not array)
- MV2 `persistent: true` background: MV3 has no equivalent

## Open Questions

1. **shadcn/ui CLI compatibility with esbuild projects**
   - What we know: CLI expects Vite/Next.js; manual `components.json` works for adding components
   - What's unclear: Whether `npx shadcn@latest init` works at all, or if entire setup must be manual
   - Recommendation: Create `components.json` manually, then use `npx shadcn@latest add button` etc. for individual components. If CLI fails, copy component source directly from shadcn docs.

2. **esbuild path alias resolution for `@/` imports**
   - What we know: TypeScript `paths` handles type checking; esbuild needs its own alias config
   - What's unclear: Exact esbuild config for alias resolution
   - Recommendation: Use esbuild `alias` option: `alias: { '@': './src' }` -- verify during implementation

3. **Tailwind v4 content scanning with esbuild PostCSS plugin**
   - What we know: Tailwind v4 auto-scans for class usage; with PostCSS plugin it should work
   - What's unclear: Whether the PostCSS plugin correctly scans `.tsx` files when invoked from esbuild
   - Recommendation: If auto-scan doesn't work, add `@source "../"` directive in globals.css to point scanner at src/

## Sources

### Primary (HIGH confidence)
- `/evanw/esbuild` via Context7 -- build API, format options, splitting limitations
- `/websites/developer_chrome_extensions` via Context7 -- MV3 manifest, CSP, content scripts, web_accessible_resources, service worker config
- `/biomejs/biome` via Context7 -- biome.json configuration, rules, overrides
- `/vitest-dev/vitest` via Context7 -- vitest.config.ts setup
- `/websites/ui_shadcn` via Context7 -- components.json manual config, Tailwind v4 compatibility
- `/websites/tailwindcss` via Context7 -- v4 PostCSS setup, @tailwindcss/postcss

### Secondary (MEDIUM confidence)
- [Chrome MV3 CSP docs](https://developer.chrome.com/docs/extensions/reference/manifest/content-security-policy) -- default policy, allowed directives
- [Tailwind CSS v4 upgrade guide](https://tailwindcss.com/docs/upgrade-guide) -- PostCSS migration
- [Tailwind/esbuild discussion #15881](https://github.com/tailwindlabs/tailwindcss/discussions/15881) -- programmatic esbuild compilation approaches
- [pnpm .npmrc docs](https://pnpm.io/npmrc) -- save-exact configuration
- [esbuild-plugin-tailwindcss](https://github.com/ttempaa/esbuild-plugin-tailwindcss) -- v2.x for Tailwind v4

### Tertiary (LOW confidence)
- React Router v7 MemoryRouter for Chrome extension popups -- community reports it works, but v7 docs label it "primarily for testing"; needs validation during implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all versions verified via npm/Context7; compatibility confirmed
- Architecture: HIGH -- MV3 patterns well-documented by Chrome team; esbuild multi-build pattern is standard for extensions
- Pitfalls: HIGH -- documented in official migration guides and community issues
- Tailwind v4 + esbuild integration: MEDIUM -- pattern is documented but less battle-tested than Vite integration

**Research date:** 2026-03-01
**Valid until:** 2026-03-31 (stable domain; versions may bump but patterns hold)
