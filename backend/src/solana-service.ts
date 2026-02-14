import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";

const DEVNET_URL = clusterApiUrl("devnet");

// Token validation: Only SOL and BRic are allowed
export const ALLOWED_TOKENS = {
  SOL: "native",
  BRIC: "BRicTokenMintAddressPlaceholder111111111111111" // Replace with actual BRic mint address
} as const;

export type AllowedCurrency = keyof typeof ALLOWED_TOKENS;

export class SolanaService {
  private connection: Connection;

  constructor() {
    this.connection = new Connection(DEVNET_URL, "confirmed");
    console.log("Solana devnet connection established - Token-only economy enforced");
  }

  /**
   * Validate that a currency is allowed in the token-only economy
   */
  validateCurrency(currency: string): currency is AllowedCurrency {
    const normalized = currency.toUpperCase();
    return normalized === "SOL" || normalized === "BRIC";
  }

  /**
   * Validate a token-based transaction before processing
   */
  async validateTokenTransaction(params: {
    currency: string;
    amount: number;
    fromWallet?: string;
  }): Promise<{ valid: boolean; error?: string }> {
    const { currency, amount, fromWallet } = params;

    // Validate currency is token-only
    if (!this.validateCurrency(currency)) {
      return {
        valid: false,
        error: `Currency '${currency}' not supported. ChAI operates on a token-only economy. Allowed: SOL, BRic`
      };
    }

    // Validate amount is positive
    if (amount <= 0) {
      return {
        valid: false,
        error: "Amount must be greater than zero"
      };
    }

    // If wallet provided, validate balance
    if (fromWallet && currency.toUpperCase() === "SOL") {
      try {
        const balance = await this.getBalance(fromWallet);
        if (balance < amount) {
          return {
            valid: false,
            error: `Insufficient balance. Required: ${amount} SOL, Available: ${balance} SOL`
          };
        }
      } catch (e) {
        return {
          valid: false,
          error: "Unable to verify wallet balance"
        };
      }
    }

    return { valid: true };
  }

  async getBalance(walletAddress: string): Promise<number> {
    try {
      const pubkey = new PublicKey(walletAddress);
      const balance = await this.connection.getBalance(pubkey);
      return balance / 1e9; // Convert lamports to SOL
    } catch (e) {
      console.error("Balance check failed:", e);
      return 0;
    }
  }

  async getRecentBlockhash(): Promise<string> {
    const { blockhash } = await this.connection.getLatestBlockhash();
    return blockhash;
  }

  async confirmTransaction(signature: string): Promise<boolean> {
    try {
      const result = await this.connection.confirmTransaction(signature);
      return !result.value.err;
    } catch {
      return false;
    }
  }

  getExplorerUrl(signature: string): string {
    return "https://explorer.solana.com/tx/" + signature + "?cluster=devnet";
  }

  /**
   * Record transaction metadata for on-chain verification
   */
  generateTransactionMetadata(params: {
    taskId: string;
    amount: number;
    currency: AllowedCurrency;
    from: string;
    to: string;
    type: "escrow_lock" | "escrow_release" | "payment";
  }): Record<string, any> {
    return {
      ...params,
      timestamp: new Date().toISOString(),
      chain: "solana",
      network: "devnet",
      tokenOnly: true,
      validatedBy: "chai-solana-service"
    };
  }
}

export const solana = new SolanaService();
