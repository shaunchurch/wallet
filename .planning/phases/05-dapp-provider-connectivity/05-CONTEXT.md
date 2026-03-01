# Phase 5: Dapp Provider & Connectivity - Context

**Gathered:** 2026-03-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Dapps discover the wallet via EIP-6963, connect with user approval, and interact through standard Ethereum provider API (EIP-1193). Covers: provider injection, connection approval, transaction confirmation from dapps, message signing (personal_sign, signTypedData_v4), chain queries, and permission management. Does NOT include: real-time streaming (Phase 6), token ecosystem (Phase 8), or transaction history (Phase 9).

</domain>

<decisions>
## Implementation Decisions

### Connection Approval UX
- Popup window opens for eth_requestAccounts — standard MetaMask pattern
- Show rich metadata: favicon, site name, description from page meta tags
- Account picker: show checkboxes for all derived accounts, user selects which to share
- Connected sites persist until explicitly revoked (stored in chrome.storage.local)

### Signing Display
- personal_sign: syntax-highlighted rendering — detect structure (JSON, hex, ASCII) and format accordingly
- signTypedData_v4 (EIP-712): structured tree view showing domain, primary type, and message fields nested with type labels
- Permit signatures: red warning banner at top ("This grants token spending approval") with spender address, token, amount, deadline in highlighted fields
- eth_sign blocked by default: error message with "Enable in Advanced Settings" link per DAPP-09

### Dapp Transaction Confirmation
- Separate dapp confirm screen (NOT reusing SendConfirmScreen) — shows dapp origin, contract details, decoded function call
- Simulation preview: balance diff preview via eth_call — compare token/ETH balance changes, show "You will send X ETH and receive Y TOKEN"
- Basic function decoding: attempt to decode common selectors (transfer, approve, swap), fallback to raw hex data
- Editable gas fields: advanced toggle to override gasLimit, maxFeePerGas, maxPriorityFeePerGas

### Permission Management
- Dedicated "Connections" screen accessible from settings AND header icon
- Each entry shows: favicon, origin URL, connected accounts, connection timestamp, disconnect button
- "Disconnect All" button at bottom with confirmation dialog
- Green dot + truncated site name in popup header when on a connected dapp

### Claude's Discretion
- Content script ↔ background message relay implementation details
- EIP-6963 provider info metadata fields
- RPC method whitelist composition (DAPP-10)
- wallet_switchEthereumChain rejection message wording
- Exact popup window dimensions and positioning
- Function selector database scope (how many common selectors to include)

</decisions>

<specifics>
## Specific Ideas

- Connection approval should feel like MetaMask's popup — familiar to crypto users
- Permit warning is a security-critical UX moment — red banner should be unmissable
- Balance diff preview makes dapp transactions much more understandable for users vs raw hex

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `content.ts`: Already injects `inpage.js` into MAIN world — ready for provider code
- `inpage.ts`: Placeholder waiting for EIP-1193 provider implementation
- `src/features/wallet/rpc/provider.ts`: rpcCall wrapper, NETWORKS config, getExplorerTxUrl
- `src/features/wallet/tx/build.ts`: buildAndSignTransaction, validateAddress, formatEth, parseEthToWei
- `src/features/wallet/rpc/gas.ts`: estimateGas, getFeeParams with 20% buffer + 60k floor
- `src/features/wallet/types.ts`: WalletMessage/WalletResponse union pattern — extend for dapp messages

### Established Patterns
- Message passing: popup → chrome.runtime.sendMessage → background handler → response
- Screen navigation: zustand store `screen` state drives App.tsx switch
- UI components: Tailwind + inline styles, card-based layouts, shimmer skeletons

### Integration Points
- `background.ts`: Add dapp message handlers (connect, sign, dapp tx) alongside existing wallet handlers
- `inpage.ts`: Inject EIP-1193 provider + EIP-6963 announceProvider
- `content.ts`: Relay messages between inpage (window.postMessage) and background (chrome.runtime)
- `App.tsx`: Add new screens (DappConnect, DappSign, DappConfirm, ConnectionsScreen)
- `store.ts`: Add dapp connection state, pending request queue
- `Header.tsx`: Add connection indicator (green dot + site name)
- `SettingsScreen.tsx`: Add link to Connections screen

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-dapp-provider-connectivity*
*Context gathered: 2026-03-01*
