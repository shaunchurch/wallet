  
**PRODUCT REQUIREMENTS DOCUMENT**

**Vibe Wallet**

A Real-Time Browser Extension Wallet for megaETH

Empty String • emptystring.dev

Version 1.0 • March 2026

**CONFIDENTIAL**

# **Table of Contents**

*This table of contents will update automatically when the document is opened in Microsoft Word. Right-click and select “Update Field” to refresh page numbers.*

# **1\. Executive Summary**

Vibe Wallet is a Chrome browser extension wallet built from scratch specifically for megaETH, the real-time Ethereum Layer 2 network. Unlike generic EVM wallets that treat megaETH as just another network to add, Vibe Wallet is purpose-built to exploit megaETH’s unique characteristics: 10-millisecond block times, the Realtime API, multidimensional gas, and EIP-7702 account abstraction support.

The core thesis is that megaETH’s performance characteristics enable a wallet UX that is simply not possible on other chains. Transactions confirm instantly. Balances update in real time. Multi-step DeFi operations can be batched into single atomic transactions. By building a wallet that leans into these capabilities rather than abstracting them away, we can deliver an experience that feels closer to a native fintech app than a traditional crypto wallet.

This document covers the full product scope from MVP through mature product, with particular attention to the security-critical components that must be right from day one, the megaETH-specific opportunities that differentiate us, and the standard EVM plumbing that we can build confidently from existing knowledge.

# **2\. Product Vision and Positioning**

## **2.1 Vision Statement**

The fastest chain deserves the fastest wallet. Vibe Wallet makes interacting with megaETH feel like using a native application, not a blockchain tool.

## **2.2 Target Users**

* DeFi power users migrating to megaETH for speed and low fees

* Developers building and testing applications on megaETH

* Airdrop farmers and early ecosystem participants who need a reliable, trustworthy wallet

* Users frustrated with MetaMask’s gas estimation failures on megaETH’s non-standard gas model

## **2.3 Competitive Positioning**

MetaMask and Rabby can connect to megaETH by adding the network, but they treat it as a generic EVM chain. This causes concrete problems: gas estimation failures due to the multidimensional gas model, no support for the Realtime API, no real-time balance updates, and no exploitation of EIP-7702 features. Vibe Wallet solves all of these by being built specifically for megaETH from the ground up.

## **2.4 Product Principles**

* **Security is non-negotiable.** Every design decision defaults to the safer option. We ship slower rather than ship insecure.

* **Speed is the brand.** If something can update in real time on megaETH, it should update in real time in the wallet.

* **Minimal dependencies.** Every npm package is an attack vector. We use audited, zero-dependency cryptographic libraries and nothing else where it matters.

* **Transparency by default.** Open source from day one. Users can verify every line of code that touches their keys.

* **UX honesty.** We clearly communicate what “confirmed” means at each level of finality. We don’t hide complexity; we present it clearly.

# **3\. Technical Architecture**

## **3.1 Extension Architecture (Manifest V3)**

Vibe Wallet is built as a Chrome Manifest V3 extension with three distinct execution contexts, each with specific security boundaries:

| Component | Role | Security Boundary |
| :---- | :---- | :---- |
| Background Service Worker | Key management, transaction signing, RPC communication, state management | Isolated from all web content. Only context that ever holds decrypted keys. |
| Content Script | EIP-1193 provider injection, message relay between dapps and background | Runs in page context but communicates with background only via chrome.runtime.sendMessage. Never has access to keys. |
| Popup UI | User-facing interface for balance display, transaction confirmation, settings | Communicates with background via chrome.runtime messaging. Renders confirmation dialogs for all sensitive operations. |

The critical security invariant is that private keys never leave the background service worker. The content script and popup can request signatures, but the actual signing always happens in the background.

## **3.2 Technology Stack**

| Layer | Technology | Rationale |
| :---- | :---- | :---- |
| UI Framework | React \+ TypeScript \+ shadcn/ui | shadcn/ui provides accessible, customisable components (dialogs, dropdowns, toasts, inputs) built on Radix UI primitives. Saves significant development time on transaction confirmation dialogs, approval popups, and form validation. Styled with Tailwind CSS. |
| State Management | Zustand | Lightweight, TypeScript-native, works well across extension contexts. |
| Cryptographic Primitives | @noble/secp256k1, @noble/hashes | Audited, zero-dependency, maintained by Paul Miller. Industry standard for wallet crypto. |
| Key Derivation | @scure/bip39, @scure/bip32 | Same author as noble libraries. Audited, zero-dependency. Handles BIP-39 mnemonics and BIP-44 HD derivation. |
| Ethereum Interaction | viem (minimal subset) | Modern, tree-shakeable, TypeScript-native. Only import what we need: transaction serialisation, ABI encoding, RPC client. |
| Transaction Encoding | @ethereumjs/tx or viem/tx | EIP-1559 (Type 2\) and EIP-7702 (Type 4\) transaction construction and RLP encoding. |
| Encryption | Web Crypto API (native) | AES-GCM encryption, PBKDF2 key derivation. No library needed; built into the browser. |
| Build System | esbuild \+ Tailwind CSS | Fast, simple bundler. Produces separate bundles for background, content script, and popup. Tree-shake aggressively to minimise React bundle size. |

## **3.3 megaETH Network Configuration**

| Parameter | Mainnet | Testnet |
| :---- | :---- | :---- |
| Chain ID | 4326 | 6342 |
| Native Currency | ETH | ETH (test) |
| RPC Endpoint | https://mainnet.megaeth.com/rpc | https://testnet.megaeth.com/rpc |
| WebSocket Endpoint | wss://mainnet.megaeth.com/ws | wss://testnet.megaeth.com/ws |
| Block Explorer | megaeth.blockscout.com | testnet.megaeth.blockscout.com |
| Intrinsic Gas (min) | 60,000 (21k compute \+ 39k storage) | 60,000 |
| Block Time (EVM) | \~1 second | \~1 second |
| Mini Block Time | \~10 milliseconds | \~10 milliseconds |
| Bridge Contract (L1) | 0x0CA3...eE75 (Ethereum mainnet) | N/A |

## **3.4 Data Flow: Transaction Lifecycle**

The transaction flow from dapp request to on-chain confirmation follows this path:

1. Dapp calls window.ethereum.request({ method: ‘eth\_sendTransaction’, params }) on the injected provider.

2. Content script receives the call and forwards the request to the background service worker via chrome.runtime.sendMessage.

3. Background service worker validates the request, enriches it with gas estimation (via megaETH RPC, never local simulation), nonce, and chain ID.

4. Background opens the popup with the transaction confirmation UI, displaying: recipient, value, estimated gas cost, and simulated balance change.

5. User reviews and approves (or rejects) in the popup.

6. Background signs the transaction with the private key using secp256k1.

7. Background submits via realtime\_sendRawTransaction to get the receipt in a single round trip (megaETH-specific).

8. Background returns the transaction hash (and optionally the receipt) to the content script, which relays it to the dapp.

9. Background updates balance state via the stateChanges WebSocket subscription.

# **4\. Security Architecture**

Security is the single most important aspect of a wallet. Every feature in this document is subordinate to the security architecture described in this section. If a feature conflicts with a security requirement, the feature is cut or redesigned.

## **4.1 Key Management**

### **4.1.1 Seed Phrase Generation**

* Entropy sourced exclusively from crypto.getRandomValues (Web Crypto API). No Math.random, no Date.now, no user-supplied entropy mixing.

* BIP-39 mnemonic generation using @scure/bip39 with the English wordlist. 12-word mnemonics (128 bits of entropy) for the default, with 24-word (256 bits) as an option.

* Mnemonic-to-seed derivation using PBKDF2 with 2048 iterations (per BIP-39 spec) and the passphrase “mnemonic”.

* HD key derivation via BIP-44 path: m/44’/60’/0’/0/0 for the first account, incrementing the last index for additional accounts.

* The seed phrase is displayed to the user exactly once during wallet creation and must be confirmed before the wallet is usable.

### **4.1.2 Encryption at Rest**

* The user sets a password during wallet creation. This password is used to derive an encryption key via PBKDF2 with at least 600,000 iterations and a random 16-byte salt.

* The derived key encrypts the seed phrase (and derived private keys) using AES-256-GCM with a random 12-byte IV per encryption operation.

* The encrypted vault (ciphertext \+ salt \+ IV) is stored in chrome.storage.local.

* When the wallet is unlocked, the decrypted key material is held in the background service worker’s memory and also stored in chrome.storage.session (which is cleared when the browser closes or the extension is disabled).

* An auto-lock timer (default: 15 minutes of inactivity) clears the decrypted key material from memory and session storage.

### **4.1.3 Key Isolation Invariants**

The following invariants must never be violated. Any code path that could potentially violate them is a critical security bug:

* **Private keys never enter a content script.** The content script is a message relay only. It never receives, processes, or temporarily holds key material.

* **Private keys never enter the popup.** The popup sends signing requests to the background and receives signed results. The key stays in the background.

* **Private keys are never serialised to a message.** Chrome.runtime.sendMessage passes structured clones. No message payload ever contains raw key bytes.

* **Private keys are never logged.** No console.log, no error reporting, no telemetry ever includes key material. This is enforced by code review policy.

* **Private keys are never included in extension storage unencrypted.** chrome.storage.local always contains the encrypted vault, never raw keys. chrome.storage.session holds the decrypted key only while unlocked.

## **4.2 Transaction Security**

### **4.2.1 Transaction Simulation**

Before presenting a transaction for user approval, the wallet simulates it using eth\_call against the megaETH RPC. The simulation result is displayed as a balance-change preview: which tokens increase, which decrease, and by how much. This catches the most common attack vector: transactions that look benign but transfer unexpected assets.

### **4.2.2 Approval Warnings**

* **Unlimited ERC-20 approvals:** If a transaction calls approve() with type(uint256).max as the amount, the wallet displays a prominent warning explaining that this grants unlimited spending access to the contract.

* **eth\_sign blocking:** The eth\_sign RPC method signs arbitrary hashes and can sign raw transactions. It is blocked by default with a clear explanation. Users can enable it in advanced settings with an explicit acknowledgement of the risk.

* **Unknown contract interaction:** When a transaction targets a contract the user has never interacted with before, the wallet flags this and displays the contract’s verification status from the block explorer API if available.

* **EIP-712 typed data display:** For eth\_signTypedData\_v4 requests, the wallet renders the structured data in a human-readable format, clearly showing the domain, types, and values being signed. Permit signatures (which can authorise token transfers without an on-chain approval transaction) receive additional warning treatment.

### **4.2.3 Gas Estimation**

This is a megaETH-specific critical requirement. MegaETH uses a multidimensional gas model where transactions consume both compute gas and storage gas. A simple ETH transfer costs 60,000 total gas (21,000 compute \+ 39,000 storage), not the 21,000 that standard EVM tools expect.

* **All gas estimation must use eth\_estimateGas against the megaETH RPC.** Local EVM simulation (as used by viem’s estimateGas or Foundry’s forge) will return incorrect values because it only calculates compute gas.

* **Minimum gas floor:** The wallet enforces a minimum gas limit of 60,000 for any transaction. Any attempt to submit a transaction with a lower gas limit is rejected before signing.

* **Gas buffer:** Apply a 20% buffer on top of the RPC’s estimate to account for state changes between estimation and execution. This is more important on megaETH than other chains because the state changes so rapidly (every 10ms).

* **Explicit test coverage:** A dedicated test verifies that a simple ETH transfer receives a gas limit of at least 60,000. This test exists to catch regressions if the gas estimation path is ever refactored.

## **4.3 Supply Chain Security**

The wallet extension is the highest-value target for supply chain attacks in the npm ecosystem. A compromised dependency that can access private keys means total loss of funds for all users.

* **Minimal dependency tree:** The cryptographic core (@noble, @scure packages) has zero transitive dependencies. The UI layer (React, shadcn/ui, Zustand) has well-known, widely-audited dependencies. The UI and crypto layers are in separate bundles with no shared code paths. Every additional package requires explicit justification.

* **Pinned versions:** All dependencies use exact version pins in package.json (no ^ or \~ prefixes). Updates are manual and reviewed.

* **Lockfile integrity:** package-lock.json is committed and its integrity hashes are verified in CI.

* **Build reproducibility:** The extension build is deterministic. Given the same source, the same binary output is produced. This allows third parties to verify that the published extension matches the open source code.

* **No runtime code loading:** The extension never uses eval(), Function(), or dynamic import() from remote sources. All code is bundled at build time.

* **Content Security Policy:** The extension’s manifest.json sets a strict CSP that prohibits inline scripts and remote script loading.

## **4.4 Extension-Specific Security**

### **4.4.1 Provider Injection**

The content script injects an EIP-1193 compatible window.ethereum object into every page. This is the primary interface between web applications and the wallet, and the primary attack surface.

* The injected provider exposes only the standard EIP-1193 methods: request(), on(), removeListener().

* No internal wallet state is accessible from the provider object. Balance, account details, and settings are fetched via RPC requests, not exposed as properties.

* The provider validates all incoming requests against a whitelist of supported RPC methods before forwarding to the background.

### **4.4.2 Service Worker Lifecycle**

Manifest V3 service workers can be terminated by Chrome after inactivity. This has implications for key management and WebSocket connections:

* On wake-up, the service worker checks chrome.storage.session for the decrypted key. If present (and within the auto-lock timeout), the wallet resumes in an unlocked state without requiring re-authentication.

* WebSocket connections (for real-time subscriptions) are re-established on wake-up. The wallet accepts that some events may be missed during sleep and reconciles state via a full balance and nonce refresh on reconnection.

* The chrome.alarms API is used to periodically wake the service worker (minimum 30-second intervals) to maintain WebSocket connections when the popup is closed. This is a best-effort optimisation; the wallet must function correctly even if alarms are delayed.

# **5\. MVP Feature Set**

The MVP is the minimum set of features required to be a functional, secure wallet that a real user could trust with real funds on megaETH. Every feature in this section is required for launch. Nothing in subsequent sections is.

## **5.1 Wallet Creation and Recovery**

* Generate a new wallet with a BIP-39 seed phrase (12 words default, 24 words optional).

* Display the seed phrase with a clear, unmissable warning that it must be backed up and never shared.

* Require seed phrase confirmation (select words in order) before the wallet is usable.

* Import an existing wallet via seed phrase entry.

* Set and manage wallet password for encryption at rest.

## **5.2 Account Management**

* Derive and display the primary account (BIP-44 path m/44’/60’/0’/0/0).

* Display the account address with a copy-to-clipboard button and QR code for receiving.

* Show ETH balance, refreshed in real time via WebSocket stateChanges subscription when the popup is open, or via polling when it’s closed.

## **5.3 Send ETH**

* Enter recipient address (with ENS resolution as a stretch goal, not MVP).

* Enter amount in ETH, with a “Max” button that calculates the maximum sendable amount after gas.

* Display estimated gas cost in ETH, derived from the megaETH RPC (never local estimation).

* Transaction confirmation screen showing: recipient, amount, gas cost, and total cost.

* Submit via realtime\_sendRawTransaction for instant receipt.

* Display transaction result (success/failure) immediately, with a link to the block explorer.

## **5.4 Dapp Connection (EIP-1193 Provider)**

* Inject a standard EIP-1193 provider as window.ethereum.

* Support eth\_requestAccounts for dapp connection with user approval.

* Support eth\_sendTransaction with the full confirmation flow described in Section 4.2.

* Support personal\_sign for message signing with clear display of the message content.

* Support eth\_signTypedData\_v4 for EIP-712 typed data signing with structured display.

* Support eth\_chainId, eth\_accounts, net\_version for chain and account queries.

* Support wallet\_switchEthereumChain (EIP-3326) — accept if the target is megaETH mainnet or testnet, reject otherwise with an explanation that this is a megaETH-specific wallet.

* Block eth\_sign by default (see Section 4.2.2).

## **5.5 Network Status**

* Display a network health indicator in the popup header (green/yellow/red).

* Monitor RPC responsiveness and mini block production rate.

* Surface network issues to the user with clear messaging rather than failing silently.

## **5.6 Transaction History**

* Display a list of recent transactions (sent and received) with status, amount, and timestamp.

* For MVP, this can be sourced from the block explorer API rather than maintained locally.

* Each transaction links to its page on the block explorer.

## **5.7 Settings**

* Lock/unlock wallet.

* Auto-lock timeout configuration (5/15/30/60 minutes).

* Network switcher (megaETH mainnet, megaETH testnet).

* Export seed phrase (behind password re-entry and explicit warning).

* About page with version number, open source link, and security contact.

# **6\. megaETH-Specific Features (Post-MVP)**

These features exploit megaETH’s unique capabilities and represent the primary differentiation from generic EVM wallets. They should be implemented after the MVP is stable and secure, in rough priority order.

## **6.1 Real-Time Balance Updates (WebSocket)**

Use the stateChanges WebSocket subscription to stream balance updates to the popup in real time. When a user receives ETH or tokens, the balance updates live without any manual refresh. This is the single most visible differentiator from MetaMask on megaETH.

Implementation considerations:

* Subscribe to stateChanges for the active account address when the popup opens.

* Parse the returned balance and storage slot changes to update both ETH balance and tracked token balances.

* Send eth\_chainId keepalive pings every 25 seconds to maintain the WebSocket connection (megaETH closes idle connections after 30 seconds).

* Handle service worker termination gracefully: reconnect on wake-up and do a full state refresh to catch any missed events.

* Display a subtle live indicator in the UI to signal that balances are streaming in real time.

## **6.2 Instant Transaction Confirmation**

Replace the standard send-then-poll pattern with realtime\_sendRawTransaction, which returns the transaction receipt in a single round trip. This eliminates the pending spinner and gives users sub-second confirmation feedback.

* On successful receipt, immediately update the UI with the confirmed transaction and new balance.

* Handle the 10-second timeout case: if realtime\_sendRawTransaction returns the “realtime transaction expired” error, fall back to polling eth\_getTransactionReceipt.

* Display mini block timestamps (microsecond precision) in the transaction details to showcase megaETH’s speed.

## **6.3 Finality Indicators**

MegaETH has three distinct finality levels that the wallet should communicate clearly:

| Level | Timing | Guarantee | UI Treatment |
| :---- | :---- | :---- | :---- |
| Mini Block Preconfirmation | \~10ms | Sequencer promise. Single-entity trust. | Green checkmark with “Preconfirmed” label. |
| EVM Block Inclusion | \~1 second | Sequencer commitment in a canonical block. Still single-entity trust. | Same green checkmark; update label to “Confirmed.” |
| L1 Settlement | \~7 days (optimistic rollup challenge period) | Cryptoeconomically secured on Ethereum mainnet. Irreversible. | Add “Settled on L1” badge after challenge period. |

For most user actions, the preconfirmation is the relevant finality level, and the UI should feel instant and confident. But for large-value transfers, the wallet should make the distinction available (in transaction details) without being preachy about it.

## **6.4 EIP-7702 Smart Account Features**

megaETH supports EIP-7702, which allows EOAs to temporarily adopt smart contract functionality. This enables features that fundamentally improve UX:

### **6.4.1 Transaction Batching**

Combine multiple operations into a single atomic transaction. The canonical example is approve \+ swap: instead of two separate transactions with two confirmation dialogs, the user confirms once and both operations execute atomically. If either fails, neither takes effect.

### **6.4.2 Gas Abstraction**

Allow users to pay gas fees in tokens other than ETH (particularly stablecoins like USDC or USDm, megaETH’s native stablecoin). This requires integration with a paymaster contract that sponsors the gas transaction in exchange for the token payment.

### **6.4.3 Spending Limits and Session Keys**

Allow users to set spending limits per dapp or per time period. Session keys enable dapps to execute transactions on the user’s behalf (up to the approved limit) without requiring confirmation for each one. This is particularly valuable for gaming and high-frequency DeFi on megaETH where the 10ms block time enables interactions that would be impractical with per-transaction confirmation.

## **6.5 Bridge Awareness**

Detect when a user has deposited ETH via the canonical bridge (contract 0x0CA3A2FBC3D770b578223FBB6b062fa875a2eE75 on Ethereum mainnet) and show an incoming deposit notification once the L1 transaction is finalised and the bridged ETH appears on megaETH. For the first-run experience, detect an empty balance and offer clear instructions for bridging via the official bridge UI.

## **6.6 Token Management**

* Auto-detect popular tokens on megaETH using a curated token list (reference: mega-tokenlist from megaETH’s GitHub).

* Display ERC-20 token balances alongside ETH.

* Support ERC-20 transfers with the same gas estimation and confirmation flow as ETH transfers.

* Allow manual token import by contract address.

* Highlight megaETH ecosystem tokens: MEGA (governance token), USDm (native stablecoin via Ethena collaboration).

# **7\. Standard EVM Plumbing**

These are the components that are standard across all EVM wallets. They’re not novel, but they must be correct. This section documents the known requirements and gotchas for each.

## **7.1 BIP-39 / BIP-44 Key Derivation**

Well-specified and well-tested by the ecosystem. Use @scure/bip39 and @scure/bip32 without modification. The critical requirement is exact byte-level correctness: if a user imports their seed phrase into MetaMask or any other BIP-39 wallet, they must see the same addresses. Test against known derivation vectors from the BIP-39 and BIP-44 specifications.

## **7.2 Transaction Serialisation**

Vibe Wallet must correctly construct, serialise, and sign at least two transaction types:

* **Type 2 (EIP-1559):** The standard modern Ethereum transaction with maxFeePerGas and maxPriorityFeePerGas. This is the default for all normal operations on megaETH.

* **Type 4 (EIP-7702):** Account abstraction transactions with an authorization\_list field. Required for the smart account features in Section 6.4.

RLP encoding must be exact. A single byte error produces either an invalid transaction (rejected by the network) or a valid transaction with wrong parameters (potentially catastrophic). Use well-tested libraries and validate against known test vectors.

## **7.3 Nonce Management**

Every transaction from an address must have a sequential nonce. For MVP, fetch the nonce from the network (eth\_getTransactionCount with “pending” tag) for each transaction. This is simple and correct for single-transaction-at-a-time usage.

For post-MVP (particularly with transaction batching), implement local nonce tracking: maintain an in-memory counter that increments on each signed transaction and resets to the on-chain value when a transaction is confirmed or fails. This prevents nonce collisions when sending multiple transactions in rapid succession.

## **7.4 RPC Communication**

Standard JSON-RPC 2.0 over HTTPS for regular calls, with WebSocket for subscriptions. Implement retry logic with exponential backoff for transient failures. Respect megaETH’s rate limiting (dynamic per-user limits). Surface rate limit errors clearly to the user rather than silently retrying forever.

## **7.5 EIP-1193 Provider Interface**

The injected provider must implement the standard EIP-1193 interface: request(args) returns a Promise, on(event, listener) for event subscriptions (accountsChanged, chainChanged, connect, disconnect), and removeListener(). This is the interface that all dapps use to detect and interact with wallets. It must behave identically to MetaMask’s implementation for compatibility, including emitting the same events in the same order during connection and disconnection.

# **8\. Known Risks and Mitigations**

This section documents the things most likely to cause problems, based on the known characteristics of megaETH and the Chrome extension environment.

| Risk | Impact | Likelihood | Mitigation |
| :---- | :---- | :---- | :---- |
| Gas estimation returns incorrect values due to multidimensional gas model | Transactions fail with “intrinsic gas too low.” Users lose confidence. | High (this is actively happening to MetaMask users on megaETH today) | Always use RPC-based estimation. Enforce 60,000 minimum gas floor. Dedicated regression test. |
| Service worker terminated by Chrome during active WebSocket session | Missed real-time events; stale balance display. | Medium-High | Reconnect on wake-up with full state refresh. Use chrome.alarms for keepalive. Accept graceful degradation. |
| Supply chain attack via compromised npm dependency | Total loss of funds for all users. | Low but catastrophic | Minimal dependency tree. Pinned versions. Lockfile integrity checks. Build reproducibility. Code audit of all crypto-touching code paths. |
| Phishing extension impersonation on Chrome Web Store | Users install fake wallet and lose funds. | Medium (common on new, hyped L2 ecosystems) | Open source for verifiability. Get listed on megaETH’s official ecosystem page. Extension verified on Chrome Web Store. Clear branding guidelines. |
| megaETH sequencer downtime | Wallet shows stale data or transactions fail. | Low-Medium (single sequencer architecture) | Network health monitoring with clear user-facing status indicator. Graceful error handling. |
| New megaEVM hardfork changes gas model or behaviour | Wallet’s gas estimation or transaction handling breaks. | Medium (megaETH is actively evolving; multiple hardforks already: MiniRex, Rex, Rex1, Rex2) | Monitor megaETH releases and changelogs. Maintain close relationship with megaETH team. Design gas estimation to be configurable rather than hardcoded. |
| Chrome Web Store review rejection or delays | Launch blocked or delayed. | Medium (wallet extensions receive extra scrutiny) | Follow all Manifest V3 requirements from day one. No remote code execution. Clear privacy policy. Submit early and iterate with the review team. |

# **9\. Development Phases**

## **9.1 Phase 1: Secure Foundation (Weeks 1–3)**

Goal: A wallet that can generate keys, encrypt them, and sign transactions correctly. No UI beyond the minimum needed to test.

1. Implement BIP-39 seed generation, BIP-44 key derivation, and secp256k1 signing. Validate against known test vectors.

2. Implement AES-256-GCM encryption with PBKDF2 key derivation using Web Crypto API. Test encrypt/decrypt round-trip.

3. Build the background service worker with key storage in chrome.storage.local (encrypted) and chrome.storage.session (decrypted, unlocked state).

4. Implement EIP-1559 transaction construction and RLP serialisation. Validate against known transaction vectors.

5. Implement gas estimation wrapper that always calls the megaETH RPC and enforces the 60,000 minimum floor.

6. Implement realtime\_sendRawTransaction submission with fallback to standard send \+ poll.

7. Write comprehensive unit tests for all cryptographic operations and transaction serialisation.

## **9.2 Phase 2: Functional Wallet (Weeks 3–5)**

Goal: A usable wallet extension that can create accounts, display balances, send ETH, and connect to dapps.

1. Build the popup UI: wallet creation flow, seed phrase backup and confirmation, password setup.

2. Implement balance display with polling (WebSocket real-time updates come later).

3. Implement send ETH flow: address entry, amount entry, gas estimation display, confirmation, and submission.

4. Build the content script with EIP-1193 provider injection.

5. Implement dapp connection flow: eth\_requestAccounts with user approval dialog.

6. Implement eth\_sendTransaction with full confirmation UI including transaction simulation preview.

7. Implement personal\_sign and eth\_signTypedData\_v4 with message/data display.

8. Implement transaction history via block explorer API.

9. Build settings: lock/unlock, auto-lock timer, network switcher, seed phrase export.

## **9.3 Phase 3: megaETH Differentiators (Weeks 5–8)**

Goal: Layer on the real-time features and smart account capabilities that make Vibe Wallet better than MetaMask on megaETH.

1. Implement WebSocket stateChanges subscription for real-time balance updates.

2. Add finality indicators (preconfirmed → confirmed → settled on L1) to transaction details.

3. Implement ERC-20 token detection and balance display using the mega-tokenlist.

4. Implement ERC-20 transfer support.

5. Add network health monitoring and status indicator.

6. Implement EIP-7702 Type 4 transaction construction for transaction batching.

7. Implement bridge deposit detection and notification.

8. Security audit of all Phase 1 and 2 code (key management, signing, provider injection).

9. Submit to Chrome Web Store.

# **10\. Quality and Testing Requirements**

## **10.1 Mandatory Test Coverage**

* **Cryptographic correctness:** Seed generation, key derivation, and signing validated against published BIP-39/BIP-44/secp256k1 test vectors. These tests are the ultimate source of truth and must pass on every build.

* **Encryption round-trip:** Encrypt a vault with a known password, decrypt it, verify the output matches. Test with edge-case passwords (empty, unicode, very long).

* **Transaction serialisation:** Construct known transactions, serialise them, verify the RLP output matches expected bytes. Test both Type 2 and Type 4 transactions.

* **Gas estimation floor:** Verify that no transaction is ever submitted with a gas limit below 60,000. This is the megaETH-specific regression test.

* **Provider isolation:** Verify that no message from the content script to the background ever contains key material. Verify that the injected provider object exposes only whitelisted methods.

* **Nonce correctness:** Verify that sequential transactions from the same account use sequential nonces.

## **10.2 Manual Testing Checklist**

* Create a new wallet, verify seed phrase, send ETH on testnet, receive ETH on testnet.

* Import the same seed phrase into MetaMask and verify the same address is derived.

* Connect to a dapp (Uniswap or similar deployed on megaETH testnet), execute a swap.

* Lock the wallet, verify it requires password to unlock.

* Wait for service worker to terminate, re-open popup, verify wallet resumes correctly.

* Attempt to interact with a dapp while the wallet is locked; verify the unlock prompt appears.

* Submit a transaction with insufficient gas; verify a clear error is displayed.

# **11\. Open Questions**

## **11.1 Naming and Branding**

“Vibe Wallet” is a working title. The final name should be distinctive, not easily confused with megaETH’s own branding, and available as a Chrome Web Store listing. Needs trademark research.

## **11.2 Multi-Chain Support**

The MVP is megaETH-only. This is a deliberate positioning choice. The question is whether the wallet should eventually support other EVM chains, or if the single-chain focus is itself a feature. Arguments for staying single-chain: simpler codebase, clearer brand, deeper integration with megaETH-specific features. Arguments against: limits addressable market, users need a second wallet for Ethereum mainnet.

## **11.3 Mobile Extension**

Chrome extension wallets don’t work on mobile browsers. If Vibe Wallet gains traction, a mobile strategy is needed. Options include: a standalone mobile app with the same key management (import via seed phrase), integration with mobile-specific wallet standards (WalletConnect), or a progressive web app approach.

## **11.4 Revenue Model**

The wallet itself is free and open source. Potential revenue paths include: swap aggregation fees (if swap functionality is added), premium features (portfolio tracking, advanced analytics), or partnership/grant arrangements with the megaETH ecosystem fund. This needs further research before commitments are made.

## **11.5 Hardware Wallet Support**

Ledger and Trezor support (via WebHID/WebUSB) is not in the MVP but is important for users with large balances. The architecture should accommodate this from the start: the signing interface in the background service worker should be abstracted so that signing via local key and signing via hardware wallet are interchangeable.

# **12\. Success Metrics**

| Metric | Target (3 months post-launch) | Measurement |
| :---- | :---- | :---- |
| Active weekly users | 1,000+ | Extension usage analytics (privacy-preserving, no key/address tracking) |
| Transaction success rate | \>99.5% | Monitor failed transactions attributable to wallet bugs vs user error or network issues |
| Gas estimation accuracy | Zero “intrinsic gas too low” errors | Error tracking in the background service worker |
| Chrome Web Store rating | 4.5+ stars | Store listing |
| Security incidents | Zero | Bug bounty programme, community reporting |
| Ecosystem listing | Listed on megaETH official ecosystem page | Official partnership |
| Time to first transaction | \<2 minutes from install | User testing |

# **Appendix A: megaETH Realtime API Reference**

The following megaETH-specific RPC methods extend the standard Ethereum JSON-RPC and are central to Vibe Wallet’s differentiated UX.

| Method | Description | Vibe Wallet Usage |
| :---- | :---- | :---- |
| realtime\_sendRawTransaction | Submits a signed transaction and returns the receipt directly, without polling. Times out after 10 seconds. | Primary transaction submission method. Enables instant confirmation UX. |
| eth\_subscribe(“stateChanges”, \[addresses\]) | WebSocket subscription that streams balance, nonce, and storage changes for specified accounts in real time. | Live balance updates in the popup. Core differentiator. |
| eth\_subscribe(“miniBlocks”) | WebSocket subscription that streams full mini block contents including transactions and receipts. | Activity feed and transaction monitoring. |
| eth\_subscribe(“logs”, {fromBlock: “pending”, toBlock: “pending”}) | WebSocket subscription for real-time event logs from mini blocks. | Token transfer detection, dapp event monitoring. |
| eth\_getLogsWithCursor | Paginated version of eth\_getLogs for large result sets. | Historical transaction and event queries. |

All Realtime API features query against the most recent mini block when invoked with “pending” or “latest” as the block tag. Standard Ethereum JSON-RPC methods also work but query against the most recent EVM block (approximately 1-second granularity rather than 10ms).

# **Appendix B: Cryptographic Library Audit Status**

| Library | Version | Audit Status | Dependencies |
| :---- | :---- | :---- | :---- |
| @noble/secp256k1 | Latest | Audited by Trail of Bits | Zero |
| @noble/hashes | Latest | Audited by Trail of Bits | Zero |
| @scure/bip39 | Latest | Audited | Zero (uses @noble/hashes) |
| @scure/bip32 | Latest | Audited | Zero (uses @noble/hashes, @noble/curves) |
| Web Crypto API | Browser native | Part of the W3C specification. Implemented by browser vendor. | N/A |

These libraries are selected specifically because they have been professionally audited, have zero transitive dependencies (eliminating supply chain risk), and are maintained by a single trusted author (Paul Miller) with a strong track record in the cryptocurrency ecosystem.