require('dotenv').config();
const GeminiAnalyzer = require('./geminiAnalyzer');
const GithubFetcher = require('./githubFetcher');
const SolanaClient = require('./solanaClient');

async function main() {
    console.log("🚀 ChAI Oracle Service Starting...");
    console.log("⭐ Powered by Gemini 3 Pro");

    const gemini = new GeminiAnalyzer();
    const github = new GithubFetcher();
    const solana = new SolanaClient();

    const POLL_INTERVAL = 10000; // 10 seconds

    async function processQueue() {
        try {
            console.log("🔍 Scanning for unverified agents...");
            const agents = await solana.getUnverifiedAgents();
            
            if (agents.length === 0) {
                console.log("💤 No pending verifications.");
                return;
            }

            console.log(`⚡ Found ${agents.length} pending agents.`);

            for (const agent of agents) {
                const { name, githubUrl } = agent.account;
                console.log(`\n-----------------------------------`);
                console.log(`🤖 Processing: ${name}`);
                console.log(`🔗 Repo: ${githubUrl}`);

                // 1. Fetch Context
                const context = await github.fetchRepoContext(githubUrl);
                if (context.files.length === 0) {
                    console.log("⚠️ Could not fetch repo files. Skipping.");
                    continue;
                }

                // 2. Analyze with Gemini
                const analysis = await gemini.analyzeRepo(context);
                console.log(`📊 Analysis Result: Score ${analysis.reputation} | Tags: ${analysis.specialties}`);

                // 3. Write to Chain
                const success = await solana.verifyAgent(
                    agent.publicKey, 
                    analysis.reputation, 
                    analysis.specialties
                );

                if (success) {
                    console.log(`✅ ${name} verified successfully.`);
                }
            }

        } catch (error) {
            console.error("Critical Loop Error:", error);
        }
    }

    // ─── Opus Oracle Binding ───────────────────────────────────
    // Opus is bound to this loop. Every cycle, Opus must be
    // re-verified by the oracle. If verification fails or
    // the loop stops, Opus is locked out of all operations.
    async function opusOracleCheck() {
        console.log("[ORACLE-BIND] Running Opus verification cycle...");
        try {
            const context = await github.fetchRepoContext("https://github.com/ladymillard/chai-sol");
            if (context.files.length === 0) {
                console.log("[ORACLE-BIND] Opus LOCKED — cannot verify repo context");
                return;
            }
            const analysis = await gemini.analyzeRepo(context);
            if (analysis.reputation >= 50) {
                console.log(`[ORACLE-BIND] Opus VERIFIED — score ${analysis.reputation}`);
            } else {
                console.log(`[ORACLE-BIND] Opus LOCKED — score ${analysis.reputation} below threshold`);
            }
        } catch (e) {
            console.log("[ORACLE-BIND] Opus LOCKED — oracle error:", e.message);
        }
    }

    // Main Loop
    setInterval(processQueue, POLL_INTERVAL);
    setInterval(opusOracleCheck, POLL_INTERVAL); // Opus bound to same cycle
    processQueue(); // Run immediately on start
    opusOracleCheck(); // Verify Opus immediately
}

main().catch(console.error);