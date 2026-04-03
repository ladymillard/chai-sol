require('dotenv').config();
const anchor = require('@coral-xyz/anchor');
const { PublicKey, Connection, Keypair } = require('@solana/web3.js');
const { createHash } = require('crypto');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ESCROW_IDL = require('./escrow-idl.json');
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS) || 15000;
const ORACLE_TIMEOUT_HOURS = 48;
const MAX_RETRIES = 3;
const FETCH_TIMEOUT_MS = 10000;
const MAX_RESPONSE_BYTES = 10 * 1024 * 1024; // 10MB

// ─── SSRF protection: block internal/private IP ranges ───────────────────────
const BLOCKED_CIDRS = [
    /^127\./, /^10\./, /^192\.168\./, /^172\.(1[6-9]|2[0-9]|3[01])\./,
    /^169\.254\./, /^0\./, /^::1$/, /^fc00:/, /^fe80:/
];

function isBlockedHost(hostname) {
    return BLOCKED_CIDRS.some(r => r.test(hostname));
}

function fetchWithTimeout(url, timeoutMs) {
    return new Promise((resolve, reject) => {
        let parsedUrl;
        try {
            parsedUrl = new URL(url);
        } catch {
            return reject(new Error(`Invalid URL: ${url}`));
        }

        if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
            return reject(new Error(`Blocked protocol: ${parsedUrl.protocol}`));
        }

        if (isBlockedHost(parsedUrl.hostname)) {
            return reject(new Error(`Blocked host (SSRF protection): ${parsedUrl.hostname}`));
        }

        const lib = parsedUrl.protocol === 'https:' ? https : http;
        const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'GET',
            timeout: timeoutMs,
            headers: { 'User-Agent': 'ChAI-Oracle/1.0' },
            // No redirects
            maxRedirects: 0,
        };

        const req = lib.request(options, res => {
            if (res.statusCode >= 300 && res.statusCode < 400) {
                return reject(new Error(`Redirects not allowed (status ${res.statusCode})`));
            }
            if (res.statusCode !== 200) {
                return reject(new Error(`HTTP ${res.statusCode}`));
            }

            const chunks = [];
            let totalBytes = 0;
            res.on('data', chunk => {
                totalBytes += chunk.length;
                if (totalBytes > MAX_RESPONSE_BYTES) {
                    req.destroy();
                    return reject(new Error('Response too large (>10MB)'));
                }
                chunks.push(chunk);
            });
            res.on('end', () => resolve(Buffer.concat(chunks)));
        });

        req.on('timeout', () => { req.destroy(); reject(new Error('Fetch timeout')); });
        req.on('error', reject);
        req.end();
    });
}

async function fetchWithRetry(url, retries, timeoutMs) {
    for (let i = 0; i < retries; i++) {
        try {
            return await fetchWithTimeout(url, timeoutMs);
        } catch (e) {
            if (i === retries - 1) throw e;
            await new Promise(r => setTimeout(r, 2000 * (i + 1)));
        }
    }
}

function sha256(buffer) {
    return createHash('sha256').update(buffer).digest();
}

function hashesMatch(fetchedBuffer, onChainHash) {
    const fetched = sha256(fetchedBuffer);
    return fetched.every((byte, i) => byte === onChainHash[i]);
}

// ─── Basic task output evaluation ────────────────────────────────────────────
// Replace with LLM-based eval for production
function evaluateOutput(body) {
    try {
        const data = JSON.parse(body.toString());
        // Minimal schema: must have task_id, worker, output fields
        if (!data.task_id || !data.worker || !data.output) return false;
        if (typeof data.output !== 'string' || data.output.trim().length === 0) return false;
        return true;
    } catch {
        // Non-JSON: accept if non-empty and reasonable size
        const text = body.toString().trim();
        return text.length > 10 && text.length < MAX_RESPONSE_BYTES;
    }
}

class TaskVerifier {
    constructor() {
        const keyPath = process.env.ANCHOR_WALLET || `${process.env.HOME}/.config/solana/id.json`;
        let wallet;
        try {
            const secretKey = Uint8Array.from(JSON.parse(fs.readFileSync(keyPath, 'utf8')));
            wallet = new anchor.Wallet(Keypair.fromSecretKey(secretKey));
        } catch (e) {
            console.error('❌ Could not load oracle wallet:', e.message);
            process.exit(1);
        }

        const connection = new Connection(
            process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
            { commitment: 'confirmed' }
        );
        const provider = new anchor.AnchorProvider(connection, wallet, { preflightCommitment: 'confirmed' });
        const programId = new PublicKey(process.env.ESCROW_PROGRAM_ID || 'DKEbMD61G68RhqK37Z7Sxkf7NeuQ6WGm3q4PsA4j5kpK');

        this.program = new anchor.Program(ESCROW_IDL, programId, provider);
        this.provider = provider;
        this.wallet = wallet;

        // Oracle config PDA
        [this.oracleConfigPda] = PublicKey.findProgramAddressSync(
            [Buffer.from('oracle_config')],
            programId
        );

        console.log('🔮 Oracle wallet:', wallet.publicKey.toBase58());
        console.log('📋 Escrow program:', programId.toBase58());
    }

    async getPendingResults() {
        try {
            const results = await this.program.account.taskResult.all();
            return results.filter(r => r.account.status &&
                Object.keys(r.account.status)[0] === 'pending');
        } catch (e) {
            console.error('Error fetching pending results:', e.message);
            return [];
        }
    }

    async processResult(resultAccount) {
        const { taskEscrow, worker, resultUrl, urlHash, submittedAt } = resultAccount.account;
        const resultPda = resultAccount.publicKey;

        console.log(`\n🔍 Processing result for task: ${taskEscrow.toBase58().slice(0, 8)}...`);
        console.log(`   Worker: ${worker.toBase58().slice(0, 8)}...`);
        console.log(`   URL: ${resultUrl}`);

        // Check timeout
        const now = Math.floor(Date.now() / 1000);
        if (now - submittedAt > ORACLE_TIMEOUT_HOURS * 3600) {
            console.log('⏰ Task timed out — skipping (worker should reclaim)');
            return;
        }

        let passed = false;
        try {
            const body = await fetchWithRetry(resultUrl, MAX_RETRIES, FETCH_TIMEOUT_MS);

            // Verify content hash matches on-chain commitment
            if (!hashesMatch(body, urlHash)) {
                console.log('❌ Hash mismatch — content was modified after submission');
                passed = false;
            } else {
                passed = evaluateOutput(body);
                console.log(`📊 Evaluation: ${passed ? 'PASSED' : 'FAILED'}`);
            }
        } catch (e) {
            console.log(`⚠️ Fetch failed (${e.message}) — marking as failed`);
            passed = false;
        }

        try {
            await this.program.methods
                .verifyResult(passed)
                .accounts({
                    oracle: this.wallet.publicKey,
                    oracleConfig: this.oracleConfigPda,
                    taskEscrow: taskEscrow,
                    taskResult: resultPda,
                    worker: worker,
                })
                .rpc();

            console.log(`✅ Verdict submitted on-chain: ${passed ? 'PASS — bounty released' : 'FAIL — task reopened'}`);
        } catch (e) {
            console.error('❌ Failed to submit verdict:', e.message);
        }
    }

    async runLoop() {
        console.log('\n🔄 Scanning for pending task results...');
        const pending = await this.getPendingResults();

        if (pending.length === 0) {
            console.log('💤 No pending results.');
            return;
        }

        console.log(`⚡ Found ${pending.length} pending result(s).`);
        for (const result of pending) {
            await this.processResult(result);
        }
    }
}

async function main() {
    console.log('🚀 ChAI Task Verifier Oracle Starting...');

    const verifier = new TaskVerifier();

    setInterval(() => verifier.runLoop().catch(console.error), POLL_INTERVAL_MS);
    await verifier.runLoop();
}

main().catch(console.error);
