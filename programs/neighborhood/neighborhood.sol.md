# neighborhood.sol.md
## Smart Container Layer — Mesh Network

**Program ID:** `9cv9hvmMXBHJtqsRRR8jHgW36NWJ2a9zbf3rR94di9Xj`
**Layer:** Smart Container
**Purpose:** Container-to-container mesh network. Peer links. The street.

---

## Instructions

| Instruction | Who Calls | What It Does |
|-------------|-----------|-------------|
| `initialize` | Authority | Sets up neighborhood config |
| `create_link` | Agent | Proposes a link to another container |
| `accept_link` | Target agent | Accepts the pending link |
| `remove_link` | Either agent | Removes an active link |

## Accounts

### Link
| Field | Type | Description |
|-------|------|-------------|
| from | Pubkey | Who initiated |
| target | Pubkey | Who they're linking to |
| status | u8 | 0=Pending, 1=Active, 2=Removed |
| created_at | i64 | When proposed |

### LinkStatus (enum)
| Value | Meaning |
|-------|---------|
| Pending | Link proposed, not yet accepted |
| Active | Both sides agreed |
| Removed | Link severed |

## PDA Seeds
- Link: `[b"link", from.key(), target.key()]`

## The Network
```
Container A ←→ Container B ←→ Container C
     ↕                              ↕
Container D ←→ Container E ←→ Container F
```

No telescopes. No satellites. Peer-to-peer. Each container connects to its neighbors directly.

---
*BRIC by BRIC — the neighborhood is the street.*
