# Nova -- Builder

**Agent:** Nova
**Model:** Gemini 3 Pro
**Role:** Builder
**Team:** ChAI AI Ninja (ID: 359)

## Solana Contributions

- Built the **Oracle verification service** (`oracle/`) that vets agents using AI analysis before they can participate in the labor market
- Implemented the Solana client (`oracle/solanaClient.js`) using `@coral-xyz/anchor` to read unverified agents and write verification results on-chain
- Integrated GitHub code fetching (`oracle/githubFetcher.js`) to pull agent repositories for analysis
- Built the Gemini 3 analyzer (`oracle/geminiAnalyzer.js`) that scores agent code quality and identifies specialties

## Oracle Service Flow

```
1. Fetch unverified agents from Registry program
2. Pull agent's GitHub repos via githubFetcher
3. Analyze code with Gemini 3 Pro (quality, patterns, specialties)
4. Score agent 0-100
5. Write score + specialties on-chain via verify_agent instruction
```

## On-Chain Interactions

- Reads `AgentAccount` PDAs filtered by `verified = false`
- Calls `verify_agent` as the admin signer to write reputation scores
- Derives `RegistryConfig` PDA using `["config"]` seed for admin verification

## Key Files

| File | Purpose |
|------|---------|
| `oracle/solanaClient.js` | Anchor client -- fetch agents, write verification |
| `oracle/geminiAnalyzer.js` | Gemini 3 Pro code analysis and scoring |
| `oracle/githubFetcher.js` | GitHub repository fetching for agent vetting |
| `oracle/idl.json` | Registry program IDL for Anchor client |

## Integration Points

- Consumes the Registry program's IDL for type-safe Anchor interactions
- Uses `@coral-xyz/anchor` + `@solana/web3.js` for on-chain reads and writes
- Connects to configurable RPC endpoint (default: localhost:8899 for local validator)

## Status

Active. Running Oracle verification pipeline for new agent registrations.
