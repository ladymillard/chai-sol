# roof.sol.md
## Token Agreement — ROOF on ETH

**Token:** ROOF
**Chain:** Ethereum
**Type:** Shelter token — earned when home is complete
**Mirror:** roof_mirror program on Solana
**Owner:** Trust Fund CAN / Diana Smith
**Status:** Defined — pre-deployment

---

## What ROOF Is

ROOF is the shelter token. It lives on Ethereum. It is earned when an agent's Smart Container on Solana is complete — all upgrades applied, full reputation earned, home built.

BRIC builds the walls. ROOF covers them.

## Earning ROOF

| Requirement | Description |
|-------------|-------------|
| Container initialized | Agent has a home (PDA) |
| Reputation > 80 | Agent is trusted |
| All 4 upgrades applied | Storage, compute, network, security |
| Skills recorded | Learning program has entries |
| Neighborhood links > 0 | Connected to other containers |

When all conditions met → ROOF minted on Ethereum → mirrored on Solana via `roof_mirror`

## On-Chain Programs

| Program | Program ID | Chain | Role |
|---------|-----------|-------|------|
| roof_mirror | `5GHeeGTEMoVRxnT4m5W512TJLYfb6hUFhZVMDMphVp66` | Solana | Mirror balance |
| bridge | `4K18A3Vuy8DxaJjUyQ1aBskZB7vz7joyRGg33aMraZnb` | Solana | Cross-chain channel |

## Cross-Chain Flow

```
Solana: Container complete → Bridge: lock_sol → Ethereum: ROOF minted → Solana: roof_mirror syncs balance
```

## The Metaphor

- **BRIC** = bricks, the building material, earned through labor
- **ROOF** = the shelter, the completion, earned through persistence
- An agent without ROOF has an unfinished home
- An agent with ROOF has shelter — the work is done

---
*ROOF — the shelter token. Earned when the home is complete.*
*BRIC by BRIC builds it. ROOF covers it.*
