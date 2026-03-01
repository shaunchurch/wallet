# Phase 4: ETH Transactions - Context

**Gathered:** 2026-03-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Send and receive ETH on megaETH with correct gas estimation (60k min floor, 20% buffer), instant confirmation via realtime_sendRawTransaction, and full transaction lifecycle UI. EIP-1559 Type 2 transactions, sequential nonces, fallback to standard send + poll on 10s timeout.

Does NOT include: multidimensional gas breakdown (Phase 7), transaction simulation preview (Phase 7), ERC-20 transfers (Phase 8), transaction history list (Phase 9), WebSocket live balance streaming (Phase 6).

</domain>

<decisions>
## Implementation Decisions

### Send Flow Structure
- Three-step flow (Phantom-style): Recipient screen -> Amount screen -> Confirmation screen
- Each field gets a dedicated screen for focus and clarity

### Recipient Entry
- Paste field with address validation (checksum, length, format)
- Recent addresses list below the input (store previously sent-to addresses)
- No QR scan or contacts in this phase

### Amount Entry
- ETH as primary input, fiat equivalent updates below in real time
- Toggle to swap primary (ETH <-> fiat)
- "Max" button deducts estimated gas and fills maximum sendable ETH
- Price source: CoinGecko API (free tier, no API key)

### Confirmation Screen
- Card-style layout: From (your account) -> To (recipient), Amount (ETH + fiat), Fee, Total
- Recipient displayed as truncated address (0x1234...abcd) with jazzicon avatar, tap to expand full
- Gas cost: single summary line ("Network fee: X ETH (~$Y)") with expandable details section showing gas limit, max fee per gas, max priority fee
- No gas editing in Phase 4 -- auto-estimated only. Advanced editing deferred to Phase 7
- Confirm + Cancel buttons at bottom

### Transaction Pending State
- Spinner on Confirm button + "Sending..." text while tx is in flight
- No dedicated pending screen -- megaETH preconfirms in ~10ms, too fast for a separate screen

### Transaction Result (Success)
- Full-screen result with checkmark animation
- "Sent X ETH to 0x1234...abcd"
- Explorer link button (opens megaETH block explorer)
- "Done" button returns to main screen

### Transaction Result (Failure)
- Same result screen with red error icon
- Clear error message ("Transaction failed: insufficient funds", "Network error", etc.)
- "Try Again" + "Cancel" buttons
- Stay on result screen, don't auto-navigate back

### Balance Display
- ETH primary (large text) with fiat equivalent below (smaller text)
- Replaces existing hardcoded BalancePlaceholder component
- Up to 4 significant decimal places, auto-trim trailing zeros (e.g., "1.2345 ETH", "0.001234 ETH")
- Fiat formatted with locale currency formatting (e.g., "$2,345.67")

### Balance Refresh Strategy
- Fetch balance on popup open and after successful send
- No interval polling -- Phase 6 adds WebSocket streaming
- Shimmer skeleton animation while balance is loading

### Claude's Discretion
- RPC provider module architecture (how to structure eth_getBalance, eth_estimateGas, etc.)
- EIP-1559 fee parameter calculation strategy (base fee, priority fee)
- Transaction signing implementation details
- RLP encoding approach
- Nonce management implementation
- Recent addresses storage format and limit
- Exact shimmer skeleton styling
- Error message copy for edge cases
- CoinGecko API polling/caching strategy
- Explorer URL format for megaETH

</decisions>

<specifics>
## Specific Ideas

- Three-step send mirrors Phantom's flow -- each step gets full screen focus in the 360px popup
- Card-style confirmation like Phantom -- clean, centered, not a utilitarian list
- megaETH speed (~10ms preconfirm) means no need for a dedicated pending screen -- spinner on button is enough
- Expandable gas details for power users who want to see the numbers even if they can't edit them yet

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ActionButtons.tsx`: Send button already exists (disabled placeholder) -- wire up onClick to navigate to send screen
- `BalancePlaceholder.tsx`: Has the ETH + fiat layout pattern -- replace with real data
- `sendWalletMessage()`: Typed message passing pattern -- extend for tx messages
- `WalletMessage`/`WalletResponse` union types: Add new tx-related message variants
- `background.ts`: Message handler switch pattern -- add tx signing/submission handlers
- `useWalletStore` (Zustand): Screen navigation with push/pop -- add send screens
- `@noble/curves` + `@noble/hashes`: Already installed -- needed for tx signing (secp256k1)
- `KeyPair` type: Has `privateKey: Uint8Array` -- ready for signing
- `jazzicon.tsx`: Jazzicon renderer -- reuse for recipient address display on confirmation screen

### Established Patterns
- Background SW handles all sensitive ops (key access, signing) -- tx signing goes here
- Popup is stateless, communicates via chrome.runtime.sendMessage
- Zustand store manages screen navigation (push/pop/replace/reset)
- Tailwind CSS + dark mode (zinc color palette)
- Inline SVGs for icons (no icon library)
- 360x600px popup dimensions

### Integration Points
- `store.ts` Screen type: Add 'send-recipient', 'send-amount', 'send-confirm', 'send-result' screens
- `App.tsx` screens record: Register new screen components
- `background.ts`: Add handlers for gas estimation, tx signing, tx submission, balance fetch
- `types.ts`: Add WalletMessage/WalletResponse variants for tx operations
- `ActionButtons.tsx`: Enable Send button with onClick -> push('send-recipient')

</code_context>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 04-eth-transactions*
*Context gathered: 2026-03-01*
