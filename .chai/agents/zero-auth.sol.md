# zero-auth.sol.md
## Protocol Specification — Zero Auth

**Protocol:** Zero Auth
**Type:** Wallet-based authentication — no passwords, no API keys
**Chain:** Solana (ed25519)
**Owner:** Trust Fund CAN / Diana Smith
**Status:** Active

---

## What Zero Auth Is

Zero Auth replaces traditional authentication (passwords, API keys, bearer tokens) with Solana wallet signatures. Your wallet IS your identity. Your signature IS your proof. Nothing else needed.

PDA = address. Signature = proof. Chain = authority.

## How It Works

### Client Side
1. Client has a Solana wallet (Phantom, Solflare, CLI keypair)
2. To authorize a payment of $50, client signs:
   ```
   message = "chai-payment:50:1707580800000"
   ```
3. Client sends 3 headers:
   ```
   X-Zero-Auth-Sig: <base64 ed25519 signature>
   X-Zero-Auth-Wallet: <Solana pubkey (base58)>
   X-Zero-Auth-Timestamp: <unix ms>
   ```

### Server Side
1. Server checks wallet matches `AUTHORIZED_WALLET` env var
2. Server checks timestamp is within 5-minute window (replay protection)
3. Server reconstructs the signed message from amount + timestamp
4. Server verifies ed25519 signature using Node.js `crypto.verify`
5. If valid → payment authorized. If not → 403.

## Security Properties

| Property | How |
|----------|-----|
| No passwords | Wallet keypair is the credential |
| No API keys | Signature is per-request, not persistent |
| Replay protection | 5-minute timestamp window |
| Amount binding | Signed message includes exact amount |
| Single authority | Only AUTHORIZED_WALLET can authorize |

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `AUTHORIZED_WALLET` | Diana's Solana pubkey — the ONLY wallet that can authorize payments |
| `HUMAN_AUTH_TOKEN` | Legacy fallback — will be deprecated once Zero Auth is primary |

## Endpoints Using Zero Auth

| Endpoint | Method | Auth |
|----------|--------|------|
| `/api/payments/deposit` | POST | Zero Auth (primary) or Legacy |
| `/api/config/stripe-key` | GET | Zero Auth (primary) or Legacy |
| `/api/auth/zero-auth` | GET | None (status endpoint) |

## Why Not Traditional Auth

| Traditional | Zero Auth |
|-------------|-----------|
| Password stored on server | Nothing stored — signature verified in real time |
| API key can be stolen | Wallet key never leaves client |
| Bearer token shared across requests | Each signature is unique (amount + timestamp) |
| Session tokens expire awkwardly | Wallet never expires |
| Centralized auth server | Decentralized — chain is the authority |

---
*Zero Auth — the chain is the authority. No passwords. No keys. No trust required.*
*PDA = address. Signature = proof.*
*BRIC by BRIC.*
