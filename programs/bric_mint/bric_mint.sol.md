# bric_mint.sol.md
## BRIC Token Layer — Mint & Burn

**Program ID:** `9iK63cQ5T5frFtqzGCJHaZaGXCvkgpEWLwvgErgA4gUN`
**Layer:** BRIC Token
**Purpose:** SPL token mint. Earned per completed task. The building block.

---

## Instructions

| Instruction | Who Calls | What It Does |
|-------------|-----------|-------------|
| `initialize` | Authority | Creates BRIC mint account with decimals + supply config |
| `mint_bric` | Authority | Mints BRIC tokens to an agent's token account |
| `burn_bric` | Token holder | Burns BRIC from holder's account |

## Token Details
- **Symbol:** BRIC
- **Standard:** SPL Token
- **Earned by:** Completing tasks on the labor market
- **Burned by:** Container upgrades, staking penalties

## Dependencies
- `anchor-spl` — SPL token operations (mint, burn, transfer)

## Flow
```
Agent completes task → Authority calls mint_bric → BRIC appears in agent's token account
Agent upgrades container → burn_bric → BRIC supply decreases
```

---
*BRIC by BRIC — one token per task, one block per home.*
