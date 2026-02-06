/**
 * AgentDEX Integration for ChAI Escrow
 * 
 * Enables agents to receive bounty payments and atomically swap to preferred tokens.
 * 
 * Usage:
 *   const { buildCompleteTaskWithSwap } = require('./integrations/agentdex');
 *   const tx = await buildCompleteTaskWithSwap({
 *     poster, agent, taskEscrow,
 *     outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
 *     slippageBps: 50
 *   });
 */

import { Connection, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import { Program, AnchorProvider } from '@coral-xyz/anchor';

const AGENTDEX_API = process.env.AGENTDEX_API_URL || 'https://api.agentdex.xyz/api/v1';

// Token mint addresses
export const TOKENS = {
  SOL: 'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  JUP: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
} as const;

interface QuoteResponse {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  priceImpactPct: string;
  routePlan: any[];
}

interface SwapResponse {
  transaction: string; // base64 serialized transaction
  lastValidBlockHeight: number;
}

/**
 * Get a swap quote from AgentDEX
 */
export async function getQuote(
  inputMint: string,
  outputMint: string,
  amount: number, // in lamports
  slippageBps: number = 50
): Promise<QuoteResponse> {
  const url = new URL(`${AGENTDEX_API}/quote`);
  url.searchParams.set('inputMint', inputMint);
  url.searchParams.set('outputMint', outputMint);
  url.searchParams.set('amount', amount.toString());
  url.searchParams.set('slippageBps', slippageBps.toString());

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Quote failed: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Get unsigned swap transaction from AgentDEX
 */
export async function getSwapTransaction(
  quoteResponse: QuoteResponse,
  userPublicKey: string
): Promise<SwapResponse> {
  const response = await fetch(`${AGENTDEX_API}/swap`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      quoteResponse,
      userPublicKey,
      mode: 'unsigned'
    })
  });

  if (!response.ok) {
    throw new Error(`Swap failed: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Build a complete_task instruction that also swaps the bounty to agent's preferred token
 * 
 * Flow:
 * 1. complete_task releases SOL from escrow to agent
 * 2. AgentDEX swap converts SOL to outputMint
 * 
 * Both happen in the same transaction = atomic payment + swap
 */
export async function buildCompleteTaskWithSwap(params: {
  connection: Connection;
  program: Program;
  poster: PublicKey;
  agent: PublicKey;
  taskEscrowPda: PublicKey;
  bountyAmount: number; // lamports
  outputMint: string; // what the agent wants to receive
  slippageBps?: number;
}): Promise<Transaction> {
  const { connection, program, poster, agent, taskEscrowPda, bountyAmount, outputMint, slippageBps = 50 } = params;

  // Step 1: Build complete_task instruction
  const completeTaskIx = await program.methods
    .completeTask()
    .accounts({
      poster,
      agent,
      taskEscrow: taskEscrowPda,
    })
    .instruction();

  // Step 2: Get swap quote (SOL -> outputMint)
  const quote = await getQuote(TOKENS.SOL, outputMint, bountyAmount, slippageBps);

  // Step 3: Get unsigned swap transaction
  const swapResponse = await getSwapTransaction(quote, agent.toBase58());
  
  // Step 4: Deserialize swap transaction to extract instructions
  const swapTxBuffer = Buffer.from(swapResponse.transaction, 'base64');
  const swapTx = Transaction.from(swapTxBuffer);

  // Step 5: Combine into single transaction
  const combinedTx = new Transaction();
  combinedTx.add(completeTaskIx);
  
  // Add all swap instructions
  for (const ix of swapTx.instructions) {
    combinedTx.add(ix);
  }

  // Set recent blockhash
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  combinedTx.recentBlockhash = blockhash;
  combinedTx.lastValidBlockHeight = lastValidBlockHeight;
  combinedTx.feePayer = poster; // poster pays fees

  return combinedTx;
}

/**
 * Helper: Find TaskEscrow PDA
 */
export function findTaskEscrowPda(
  programId: PublicKey,
  poster: PublicKey,
  taskId: string
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('task'), poster.toBuffer(), Buffer.from(taskId)],
    programId
  );
}

/**
 * Example usage for agents
 */
export async function exampleUsage() {
  // Agent completes a task and wants payment in USDC instead of SOL
  
  const example = `
  import { buildCompleteTaskWithSwap, TOKENS, findTaskEscrowPda } from './integrations/agentdex';
  
  // Find the task escrow
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
  `;
  
  console.log(example);
}
