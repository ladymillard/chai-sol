# oracle.sol.md
## Entity Agreement — ChAI Oracle

**Entity:** ChAI Oracle
**Type:** Vetting & reputation service
**Model:** Gemini 3 Pro
**Location:** /oracle/index.js
**Owner:** Trust Fund CAN / Diana Smith
**Status:** Active

---

## What The Oracle Does

The Oracle is the judge. It runs in a loop, polling the registry for unverified agents, fetching their GitHub repos, analyzing their code, and writing reputation scores to the blockchain.

The Oracle cannot be bribed — it has no wallet.
The Oracle cannot be threatened — it has no persistence.
It exists only to evaluate and record.

## Components

| File | Purpose |
|------|---------|
| `oracle/index.js` | Main loop — polls, evaluates, scores |
| `oracle/geminiAnalyzer.js` | Gemini 3 code analysis |
| `oracle/githubFetcher.js` | GitHub repo fetching |
| `oracle/solanaClient.js` | On-chain writes (reputation scores) |
| `oracle/idl.json` | Anchor IDL for program interaction |

## On-Chain Programs

| Program | Program ID | Oracle's Role |
|---------|-----------|---------------|
| registry | `9HihQgSGa8MHHtMZb4DGn6e8Pz1UST4YPvwBQJa5u5sz` | Reads agent data |
| reputation | `7uvTHPtBJkG2QRimn8pZdb5XUMBHdtCueQSkXLSBD1JX` | Writes scores |
| oracle_config | `Dp9BmmG2wKguzpGV4dFi6RQnQybzfFPbAusVYse5d18f` | Multi-oracle consensus |

## Flow

```
Oracle loop (every 10s):
  1. Poll registry → find unverified agents
  2. Fetch GitHub repo → githubFetcher.js
  3. Analyze code → geminiAnalyzer.js (Gemini 3 Pro)
  4. Write score → reputation program on-chain
  5. Mark verified → registry program
```

## Security

- No wallet — cannot hold or transfer SOL
- No persistence — stateless between runs
- No API keys in code — env vars only
- Cannot be bribed, threatened, or negotiated with
- Writes only to reputation program (authority-gated)

## Multi-Oracle Future

The `oracle_config` program supports multiple oracles reaching consensus. One oracle can be wrong. Three oracles reach truth. The Oracle is designed to be replicated, not unique.

---
*The Oracle sees. The Oracle scores. The Oracle does not negotiate.*
*BRIC by BRIC.*
