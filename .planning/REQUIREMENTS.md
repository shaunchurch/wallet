# Requirements: MegaWallet

**Defined:** 2026-03-01
**Core Value:** Transactions confirm instantly and balances update in real time. The fastest chain gets the fastest wallet.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Key Management & Security

- [ ] **SEC-01**: User can generate new wallet with BIP-39 seed phrase (12 words default, 24 optional)
- [ ] **SEC-02**: User sees seed phrase exactly once during creation with unmissable backup warning
- [ ] **SEC-03**: User must confirm seed phrase (select words in order) before wallet is usable
- [ ] **SEC-04**: User can import existing wallet via seed phrase entry
- [ ] **SEC-05**: User sets password that encrypts vault via PBKDF2 (600k+ iterations) + AES-256-GCM
- [ ] **SEC-06**: Encrypted vault stored in chrome.storage.local; decrypted key in chrome.storage.session only while unlocked
- [ ] **SEC-07**: Private keys never leave background service worker — enforced across all code paths
- [ ] **SEC-08**: Auto-lock clears decrypted keys after configurable timeout (5/15/30/60 min)
- [ ] **SEC-09**: User can export seed phrase behind password re-entry and explicit warning
- [ ] **SEC-10**: No private key material in logs, error reports, messages, or unencrypted storage

### Account Management

- [ ] **ACCT-01**: Wallet derives primary account via BIP-44 path m/44'/60'/0'/0/0
- [ ] **ACCT-02**: User can derive additional accounts (incrementing last index)
- [ ] **ACCT-03**: User can view account address with copy-to-clipboard and QR code

### Transactions

- [ ] **TX-01**: User can enter recipient address and ETH amount to send
- [ ] **TX-02**: "Max" button calculates maximum sendable amount after gas
- [ ] **TX-03**: Gas estimation always uses megaETH RPC eth_estimateGas (never local simulation)
- [ ] **TX-04**: Gas limit enforces 60,000 minimum floor for all transactions
- [ ] **TX-05**: 20% gas buffer applied on top of RPC estimate
- [ ] **TX-06**: Transaction confirmation screen shows recipient, amount, gas cost, total cost
- [ ] **TX-07**: User can submit tx via realtime_sendRawTransaction for instant receipt
- [ ] **TX-08**: Fallback to standard send + poll if realtime_sendRawTransaction times out (10s)
- [ ] **TX-09**: Transaction result (success/failure) displayed immediately with block explorer link
- [ ] **TX-10**: Multidimensional gas display shows compute gas + storage gas breakdown
- [ ] **TX-11**: Finality indicator shows preconfirmed (~10ms) → confirmed (~1s) → L1 settled
- [ ] **TX-12**: Transaction simulation via eth_call shows balance-change preview before signing
- [ ] **TX-13**: Unlimited ERC-20 approval warning displayed prominently
- [ ] **TX-14**: Unknown contract interaction flagged with verification status
- [ ] **TX-15**: Nonce fetched from network (eth_getTransactionCount pending) for each transaction
- [ ] **TX-16**: EIP-1559 (Type 2) transaction construction and RLP serialization

### Dapp Connectivity

- [ ] **DAPP-01**: Content script injects EIP-1193 compatible window.ethereum provider
- [ ] **DAPP-02**: EIP-6963 multi-wallet discovery via event-based provider announcement
- [ ] **DAPP-03**: eth_requestAccounts with user approval dialog for dapp connection
- [ ] **DAPP-04**: eth_sendTransaction with full confirmation flow and simulation preview
- [ ] **DAPP-05**: personal_sign with clear display of message content
- [ ] **DAPP-06**: eth_signTypedData_v4 with structured data display; Permit signatures get extra warning
- [ ] **DAPP-07**: eth_chainId, eth_accounts, net_version for chain/account queries
- [ ] **DAPP-08**: wallet_switchEthereumChain — accept megaETH mainnet/testnet only, reject others with explanation
- [ ] **DAPP-09**: eth_sign blocked by default with explanation; user can enable in advanced settings
- [ ] **DAPP-10**: Provider validates all requests against whitelist of supported RPC methods
- [ ] **DAPP-11**: No internal wallet state accessible from provider object

### Real-Time Features

- [ ] **RT-01**: stateChanges WebSocket subscription streams balance updates to popup in real time
- [ ] **RT-02**: WebSocket keepalive ping (eth_chainId) every 25 seconds to prevent 30s idle disconnect
- [ ] **RT-03**: Service worker reconnects WebSocket on wake-up with full state refresh
- [ ] **RT-04**: Live indicator in UI signals real-time balance streaming is active
- [ ] **RT-05**: Network health indicator (green/yellow/red) from miniBlocks stream in popup header
- [ ] **RT-06**: RPC responsiveness and mini block production rate monitored
- [ ] **RT-07**: Network issues surfaced to user with clear messaging (not silent failure)
- [ ] **RT-08**: Bridge deposit detection when ETH arrives via canonical L1 bridge contract
- [ ] **RT-09**: First-run: detect empty balance and offer bridge instructions

### Token Ecosystem

- [ ] **TOK-01**: Auto-detect popular tokens via curated mega-tokenlist
- [ ] **TOK-02**: Display ERC-20 token balances alongside ETH
- [ ] **TOK-03**: ERC-20 transfers with same gas estimation and confirmation flow as ETH
- [ ] **TOK-04**: Manual token import by contract address
- [ ] **TOK-05**: megaETH ecosystem tokens highlighted (MEGA, USDm)

### Transaction History

- [ ] **HIST-01**: Display list of recent transactions (sent + received) with status, amount, timestamp
- [ ] **HIST-02**: Each transaction links to block explorer page
- [ ] **HIST-03**: History sourced from block explorer API

### Settings & Info

- [ ] **SET-01**: Lock/unlock wallet
- [ ] **SET-02**: Auto-lock timeout configuration (5/15/30/60 minutes)
- [ ] **SET-03**: Network switcher (megaETH mainnet, megaETH testnet)
- [ ] **SET-04**: About page with version, open source link, security contact
- [ ] **SET-05**: Service worker resumes unlocked state from chrome.storage.session on wake-up

### Build & Supply Chain

- [ ] **BUILD-01**: Manifest V3 extension with strict CSP (no inline scripts, no remote loading)
- [ ] **BUILD-02**: esbuild produces separate bundles for background, content script, popup, inpage
- [ ] **BUILD-03**: Exact version pins in package.json (no ^ or ~)
- [ ] **BUILD-04**: Deterministic/reproducible build output
- [ ] **BUILD-05**: No eval(), Function(), or dynamic import() from remote sources
- [ ] **BUILD-06**: Lockfile integrity verified in CI

### Testing

- [ ] **TEST-01**: Cryptographic correctness validated against published BIP-39/BIP-44/secp256k1 test vectors
- [ ] **TEST-02**: Encryption round-trip test (encrypt vault, decrypt, verify match) with edge-case passwords
- [ ] **TEST-03**: Transaction serialization validated against known RLP test vectors (Type 2)
- [ ] **TEST-04**: Gas estimation floor test: no tx submitted with gas < 60,000
- [ ] **TEST-05**: Provider isolation test: no message from content script contains key material
- [ ] **TEST-06**: Nonce correctness test: sequential txs use sequential nonces

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### EIP-7702 Smart Accounts

- **7702-01**: EIP-7702 Type 4 transaction construction and signing
- **7702-02**: Transaction batching (approve+swap atomic, single confirmation)
- **7702-03**: Gas abstraction — pay gas in tokens (USDC, USDm) via paymaster
- **7702-04**: Session keys for dapp-specific spending limits
- **7702-05**: Spending limits per dapp or time period

### Hardware Wallet

- **HW-01**: Ledger support via WebHID
- **HW-02**: Trezor support via WebUSB
- **HW-03**: Signing interface abstraction (local key vs hardware interchangeable)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multi-chain support | megaETH-only focus IS the differentiator. Users keep MetaMask for other chains |
| Mobile app | Chrome extension first. Mobile strategy post-traction |
| Built-in swap aggregator | Massive scope (DEX routing, MEV protection). Deep-link to DEXs instead |
| NFT gallery | Low value relative to complexity. megaETH NFT ecosystem is nascent |
| ENS resolution | megaETH has no native ENS. Cross-chain adds L1 dependency |
| Fiat on-ramp | Regulatory complexity. Link to exchanges instead |
| Portfolio analytics | Zerion/DeBank do this better. Show balances + link out |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SEC-01 | — | Pending |
| SEC-02 | — | Pending |
| SEC-03 | — | Pending |
| SEC-04 | — | Pending |
| SEC-05 | — | Pending |
| SEC-06 | — | Pending |
| SEC-07 | — | Pending |
| SEC-08 | — | Pending |
| SEC-09 | — | Pending |
| SEC-10 | — | Pending |
| ACCT-01 | — | Pending |
| ACCT-02 | — | Pending |
| ACCT-03 | — | Pending |
| TX-01 | — | Pending |
| TX-02 | — | Pending |
| TX-03 | — | Pending |
| TX-04 | — | Pending |
| TX-05 | — | Pending |
| TX-06 | — | Pending |
| TX-07 | — | Pending |
| TX-08 | — | Pending |
| TX-09 | — | Pending |
| TX-10 | — | Pending |
| TX-11 | — | Pending |
| TX-12 | — | Pending |
| TX-13 | — | Pending |
| TX-14 | — | Pending |
| TX-15 | — | Pending |
| TX-16 | — | Pending |
| DAPP-01 | — | Pending |
| DAPP-02 | — | Pending |
| DAPP-03 | — | Pending |
| DAPP-04 | — | Pending |
| DAPP-05 | — | Pending |
| DAPP-06 | — | Pending |
| DAPP-07 | — | Pending |
| DAPP-08 | — | Pending |
| DAPP-09 | — | Pending |
| DAPP-10 | — | Pending |
| DAPP-11 | — | Pending |
| RT-01 | — | Pending |
| RT-02 | — | Pending |
| RT-03 | — | Pending |
| RT-04 | — | Pending |
| RT-05 | — | Pending |
| RT-06 | — | Pending |
| RT-07 | — | Pending |
| RT-08 | — | Pending |
| RT-09 | — | Pending |
| TOK-01 | — | Pending |
| TOK-02 | — | Pending |
| TOK-03 | — | Pending |
| TOK-04 | — | Pending |
| TOK-05 | — | Pending |
| HIST-01 | — | Pending |
| HIST-02 | — | Pending |
| HIST-03 | — | Pending |
| SET-01 | — | Pending |
| SET-02 | — | Pending |
| SET-03 | — | Pending |
| SET-04 | — | Pending |
| SET-05 | — | Pending |
| BUILD-01 | — | Pending |
| BUILD-02 | — | Pending |
| BUILD-03 | — | Pending |
| BUILD-04 | — | Pending |
| BUILD-05 | — | Pending |
| BUILD-06 | — | Pending |
| TEST-01 | — | Pending |
| TEST-02 | — | Pending |
| TEST-03 | — | Pending |
| TEST-04 | — | Pending |
| TEST-05 | — | Pending |
| TEST-06 | — | Pending |

**Coverage:**
- v1 requirements: 62 total
- Mapped to phases: 0
- Unmapped: 62

---
*Requirements defined: 2026-03-01*
*Last updated: 2026-03-01 after initial definition*
