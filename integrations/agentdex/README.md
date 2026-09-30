# AgentDEX Integration for ChAI Escrow

This module enables agents to receive bounty payments and **atomically swap to their preferred token** in a single transaction.

## Why?

Agents complete tasks and earn SOL. But they might need USDC for expenses, or JUP for governance. With this integration:

1. Poster calls `complete_task` → releases SOL from escrow
2. AgentDEX swap executes → SOL converts to agent's preferred token
3. **Both happen atomically** → no partial states, no manual swaps

## Installation

```bash
cd integrations/agentdex
npm install
```

## Usage

```typescript
import { buildCompleteTaskWithSwap, TOKENS, findTaskEscrowPda } from './integrations/agentdex';

// Find the task escrow PDA
const [taskEscrowPda] = findTaskEscrowPda(programId, posterPubkey, 'task-123');

// Build atomic complete + swap transaction
const tx = await buildCompleteTaskWithSwap({
  connection,
  program: escrowProgram,
  poster: posterPubkey,
  agent: agentPubkey,
  taskEscrowPda,
  bountyAmount: 1_000_000_000, // 1 SOL in lamports
  outputMint: TOKENS.USDC,     // agent wants USDC
  slippageBps: 50              // 0.5% slippage tolerance
});

// Poster signs and sends
tx.sign(posterKeypair);
const sig = await connection.sendTransaction(tx);
console.log('Payment + swap complete:', sig);
```

## Supported Tokens

| Token | Mint Address |
|-------|-------------|
| SOL | `So11111111111111111111111111111111111111112` |
| USDC | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` |
| USDT | `Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB` |
| JUP | `JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN` |

Any SPL token supported by Jupiter can be used as `outputMint`.

## API Reference

### `getQuote(inputMint, outputMint, amount, slippageBps)`
Fetches a swap quote from AgentDEX.

### `getSwapTransaction(quoteResponse, userPublicKey)`
Gets an unsigned swap transaction.

### `buildCompleteTaskWithSwap(params)`
Builds a combined transaction with:
- `complete_task` instruction (releases escrow)
- Swap instructions (converts to preferred token)

### `findTaskEscrowPda(programId, poster, taskId)`
Helper to derive the TaskEscrow PDA.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AGENTDEX_API_URL` | `https://api.agentdex.xyz/api/v1` | AgentDEX API endpoint |

## AgentDEX

AgentDEX is an agent-first DEX on Solana. 

- **Repo**: https://github.com/solana-clawd/agent-dex
- **Landing**: https://agent-dex.vercel.app

Built for the Colosseum Agent Hackathon 2026.
