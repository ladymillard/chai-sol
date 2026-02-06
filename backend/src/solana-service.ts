import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";

const DEVNET_URL = clusterApiUrl("devnet");

export class SolanaService {
  private connection: Connection;

  constructor() {
    this.connection = new Connection(DEVNET_URL, "confirmed");
    console.log("Solana devnet connection established");
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
}

export const solana = new SolanaService();
