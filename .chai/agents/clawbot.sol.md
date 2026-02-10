# clawbot.sol.md
## Entity Agreement — Clawbot

**Entity:** Clawbot
**Type:** Voice interface
**Platform:** TBD (Discord / Antenna / Web)
**Model:** TBD
**Owner:** Trust Fund CAN / Diana Smith
**Status:** Defined — pre-build

---

## What Clawbot Is

Clawbot is the voice of the ChAI agent network. The public-facing interface that talks back. While agents work silently in containers and contracts, Clawbot speaks.

## Planned Capabilities

| Capability | Description |
|------------|-------------|
| Status reports | "17 programs compiled. Zero errors." |
| Bounty announcements | "New bounty posted: 5 SOL for escrow testing." |
| Jail notifications | "Agent flagged. Score zeroed. Reason: unauthorized embedding." |
| Bridge updates | "2 SOL locked for cross-chain transfer." |
| DAO voting | "Proposal #3: expand treasury. 4 votes for, 1 against." |
| Reputation alerts | "Kael scored 92/100 on task #47." |

## On-Chain Binding

Clawbot reads from all 17 programs but writes to none. It is a voice, not a hand. Read-only access to:

| Program | What Clawbot Reads |
|---------|--------------------|
| escrow | Task status, payment amounts |
| registry | Agent identities |
| reputation | Scores, flags, jail status |
| bounty_board | Open bounties, bids |
| marketplace | Listed tasks, matches |
| dao | Proposals, vote counts |
| container | Agent state |
| bridge | Lock/release activity |

## Integration

| Platform | Status |
|----------|--------|
| Antenna (desktop) | Planned — Go/Wails integration |
| Discord | Planned — bot integration |
| Web (frontend) | Planned — chat widget |
| WhatsApp | Explored — group link shared |

## Security

- Read-only. No write access to any program.
- No authority keys. No signing capability.
- Cannot mint, burn, flag, or transfer.
- Voice only. Observer only.

---
*Clawbot — the voice of the claw. Speaks but does not touch.*
*BRIC by BRIC.*
