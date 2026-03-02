# Phase 1: Build & Extension Scaffold - Context

**Gathered:** 2026-03-01
**Status:** Ready for planning

<domain>
## Phase Boundary

MV3 Chrome extension that loads with correct manifest, strict CSP, esbuild multi-bundle pipeline (background ESM, content IIFE, popup, inpage IIFE), and deterministic reproducible builds. Placeholder popup UI demonstrates the extension works. No wallet logic — that's Phase 2+.

</domain>

<decisions>
## Implementation Decisions

### UI Framework
- React 19 (latest stable)
- Zustand for state management
- shadcn/ui components (copy-paste, Radix-based, ownable)
- React Router with MemoryRouter for popup navigation
- Maximum TypeScript strictness (strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes)
- Chrome-only target (Chromium browsers get it free; Firefox deferred)
- Typed wrappers around chrome.runtime messaging (no library deps)

### Styling
- Tailwind CSS (pairs with shadcn/ui)
- Light + dark mode toggle (not dark-only)
- Monochrome palette + purple/violet accent
- 360x600 popup dimensions (industry standard)

### Placeholder Popup
- Styled skeleton previewing eventual layout (header bar, balance area, action buttons — all placeholder)
- Placeholder text logo/SVG icon (no brand assets yet)
- Extension name: "vibewallet" (lowercase)
- Manifest description: "The fastest wallet for the fastest chain"

### Source Organization
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

</decisions>

<specifics>
## Specific Ideas

- Extension name is lowercase "vibewallet" — dev/hacker aesthetic
- Tagline "The fastest wallet for the fastest chain" — speed is the brand
- Styled skeleton popup should preview the vision even before wallet logic exists
- Both light and dark themes from day 1 (unusual for crypto wallets but user preference)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project, no existing code

### Established Patterns
- None — all patterns will be established in this phase

### Integration Points
- PRD exists at vibewallet-prd.md with detailed megaETH-specific requirements
- .planning/ directory initialized with ROADMAP.md and REQUIREMENTS.md

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-build-extension-scaffold*
*Context gathered: 2026-03-01*
