require('dotenv').config();
const anchor = require("@coral-xyz/anchor");
const { PublicKey, Connection, Keypair } = require("@solana/web3.js");
const fs = require('fs');
const idl = require('./idl.json');

class SolanaClient {
    constructor() {
        // Load keypair from file or env
        // Assuming typical solana config or a local key file for the oracle
        const keyPath = process.env.ANCHOR_WALLET || '/home/ubuntu/.config/solana/id.json';
        
        let wallet;
        try {
            const secretKey = Uint8Array.from(JSON.parse(fs.readFileSync(keyPath, 'utf8')));
            wallet = new anchor.Wallet(Keypair.fromSecretKey(secretKey));
        } catch (e) {
            console.warn("⚠️ Could not load wallet from file. Using dummy wallet for read-only.");
            wallet = new anchor.Wallet(Keypair.generate());
        }

        const connection = new Connection(process.env.SOLANA_RPC_URL || "http://127.0.0.1:8899");
        const provider = new anchor.AnchorProvider(connection, wallet, { preflightCommitment: "processed" });
        
        // Use the Program ID from the IDL or code (replace with actual deployed ID)
        const programId = new PublicKey("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS"); 
        
        this.program = new anchor.Program(idl, programId, provider);
        this.provider = provider;
    }

    async getUnverifiedAgents() {
        // Fetch all agent accounts
        // Filter for verified = false
        // In production we'd use getProgramAccounts with memcmp filter
        try {
            const agents = await this.program.account.agentAccount.all([
                {
                    memcmp: {
                        offset: 8 + 32 + 54 + 34 + 204 + 204 + 204 + 16, // Rough offset calc needed or just fetch all
                        // Easier to fetch all and filter in JS for hackathon scale
                        bytes: "", // No filter, get all
                    }
                }
            ]);
            
            return agents.filter(a => !a.account.verified && a.account.githubUrl.length > 0);
        } catch (e) {
            console.error("Error fetching agents:", e);
            return [];
        }
    }

    async verifyAgent(agentPublicKey, score, specialties) {
        console.log(`📝 Writing verification to chain for ${agentPublicKey.toString()}...`);
        
        try {
            const [configPda] = PublicKey.findProgramAddressSync(
                [Buffer.from("config")],
                this.program.programId
            );

            await this.program.methods
                .verifyAgent(score, specialties)
                .accounts({
                    agentAccount: agentPublicKey,
                    registryConfig: configPda,
                    admin: this.provider.wallet.publicKey,
                })
                .rpc();
                
            console.log("✅ On-chain verification complete.");
            return true;
        } catch (e) {
            console.error("❌ Transaction failed:", e);
            return false;
        }
    }
}

module.exports = SolanaClient;