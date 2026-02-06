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

    // Main Loop
    setInterval(processQueue, POLL_INTERVAL);
    processQueue(); // Run immediately on start
}

main().catch(console.error);