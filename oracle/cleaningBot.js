require('dotenv').config();
const anchor = require("@coral-xyz/anchor");
const { PublicKey, Connection, Keypair, LAMPORTS_PER_SOL } = require("@solana/web3.js");
const fs = require('fs');

// ─── ChAI Cleaning Bot ─────────────────────────────────────────────────────
// Standalone fund tracker. No server dependency.
// Scans on-chain accounts, tracks balances, escrow states, and agent earnings.
// Outputs a clean ledger every cycle.

const LEDGER_FILE = './fund-ledger.json';
const POLL_INTERVAL = 15000; // 15 seconds

// Known wallets
const TREASURY_SOL = 'HuoWuMBGPhaWa3RNSHryv1f7ApfJooUwmYMfzLovn4FY';
const PROGRAM_ID = 'Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS';
const ESCROW_PROGRAM_ID = 'Escrow11111111111111111111111111111111111111';

class CleaningBot {
    constructor() {
        this.rpcUrl = process.env.SOLANA_RPC_URL || 'http://127.0.0.1:8899';
        this.connection = new Connection(this.rpcUrl);
        this.ledger = this.loadLedger();
        this.cycleCount = 0;
    }

    loadLedger() {
        try {
            return JSON.parse(fs.readFileSync(LEDGER_FILE, 'utf8'));
        } catch {
            return {
                created: new Date().toISOString(),
                lastScan: null,
                treasury: { address: TREASURY_SOL, balance: 0, history: [] },
                agents: {},
                escrows: {},
                anomalies: [],
                totals: { inflow: 0, outflow: 0, escrowLocked: 0, agentEarnings: 0 }
            };
        }
    }

    saveLedger() {
        fs.writeFileSync(LEDGER_FILE, JSON.stringify(this.ledger, null, 2));
    }

    async scanTreasury() {
        try {
            const pubkey = new PublicKey(TREASURY_SOL);
            const balance = await this.connection.getBalance(pubkey);
            const solBalance = balance / LAMPORTS_PER_SOL;

            const prev = this.ledger.treasury.balance;
            if (prev !== solBalance) {
                const delta = solBalance - prev;
                const entry = {
                    timestamp: new Date().toISOString(),
                    prev,
                    current: solBalance,
                    delta,
                    type: delta > 0 ? 'inflow' : 'outflow'
                };
                this.ledger.treasury.history.push(entry);

                if (delta > 0) this.ledger.totals.inflow += delta;
                else this.ledger.totals.outflow += Math.abs(delta);

                console.log(`[CLEAN] Treasury ${delta > 0 ? '+' : ''}${delta.toFixed(4)} SOL (${solBalance.toFixed(4)} total)`);
            }

            this.ledger.treasury.balance = solBalance;
        } catch (e) {
            console.log('[CLEAN] Treasury scan failed:', e.message);
        }
    }

    async scanAgentAccounts() {
        try {
            const programId = new PublicKey(PROGRAM_ID);
            const accounts = await this.connection.getProgramAccounts(programId);

            for (const account of accounts) {
                const key = account.pubkey.toString();
                const data = account.account.data;

                // Track raw account balance (rent + any SOL held)
                const lamports = account.account.lamports;
                const sol = lamports / LAMPORTS_PER_SOL;

                const prev = this.ledger.agents[key];
                if (!prev) {
                    this.ledger.agents[key] = {
                        address: key,
                        balance: sol,
                        firstSeen: new Date().toISOString(),
                        lastUpdated: new Date().toISOString(),
                        changes: []
                    };
                    console.log(`[CLEAN] New agent account: ${key.slice(0, 8)}... (${sol.toFixed(4)} SOL)`);
                } else if (prev.balance !== sol) {
                    const delta = sol - prev.balance;
                    prev.changes.push({
                        timestamp: new Date().toISOString(),
                        prev: prev.balance,
                        current: sol,
                        delta
                    });
                    prev.balance = sol;
                    prev.lastUpdated = new Date().toISOString();

                    this.ledger.totals.agentEarnings += delta > 0 ? delta : 0;
                    console.log(`[CLEAN] Agent ${key.slice(0, 8)}... ${delta > 0 ? '+' : ''}${delta.toFixed(4)} SOL`);
                }
            }
        } catch (e) {
            console.log('[CLEAN] Agent scan failed:', e.message);
        }
    }

    async scanEscrows() {
        try {
            const escrowId = new PublicKey(ESCROW_PROGRAM_ID);
            const accounts = await this.connection.getProgramAccounts(escrowId);

            let totalLocked = 0;

            for (const account of accounts) {
                const key = account.pubkey.toString();
                const sol = account.account.lamports / LAMPORTS_PER_SOL;
                totalLocked += sol;

                const prev = this.ledger.escrows[key];
                if (!prev) {
                    this.ledger.escrows[key] = {
                        address: key,
                        balance: sol,
                        firstSeen: new Date().toISOString(),
                        status: sol > 0 ? 'locked' : 'empty'
                    };
                    console.log(`[CLEAN] Escrow found: ${key.slice(0, 8)}... (${sol.toFixed(4)} SOL)`);
                } else {
                    if (prev.balance > 0 && sol === 0) {
                        prev.status = 'released';
                        console.log(`[CLEAN] Escrow ${key.slice(0, 8)}... RELEASED`);
                    } else if (prev.balance === 0 && sol > 0) {
                        prev.status = 'locked';
                        console.log(`[CLEAN] Escrow ${key.slice(0, 8)}... LOCKED (${sol.toFixed(4)} SOL)`);
                    }
                    prev.balance = sol;
                }
            }

            this.ledger.totals.escrowLocked = totalLocked;
        } catch (e) {
            // Escrow program may not be deployed yet — not an anomaly
            if (!e.message.includes('Invalid param')) {
                console.log('[CLEAN] Escrow scan skipped:', e.message);
            }
        }
    }

    async scanRecentTransactions() {
        try {
            const pubkey = new PublicKey(TREASURY_SOL);
            const sigs = await this.connection.getSignaturesForAddress(pubkey, { limit: 10 });

            for (const sig of sigs) {
                const existing = this.ledger.treasury.history.find(h => h.signature === sig.signature);
                if (!existing) {
                    // Flag large or unusual transactions
                    if (sig.err) {
                        this.ledger.anomalies.push({
                            timestamp: new Date().toISOString(),
                            type: 'failed_tx',
                            signature: sig.signature,
                            memo: sig.memo || null
                        });
                        console.log(`[CLEAN] ANOMALY: Failed tx ${sig.signature.slice(0, 12)}...`);
                    }
                }
            }
        } catch (e) {
            // Silent — treasury may not have transactions yet
        }
    }

    printSummary() {
        const t = this.ledger.totals;
        const agents = Object.keys(this.ledger.agents).length;
        const escrows = Object.keys(this.ledger.escrows).length;
        const anomalies = this.ledger.anomalies.length;

        console.log(`\n[CLEAN] ── Cycle #${this.cycleCount} Summary ──`);
        console.log(`  Treasury:  ${this.ledger.treasury.balance.toFixed(4)} SOL`);
        console.log(`  Agents:    ${agents} tracked`);
        console.log(`  Escrows:   ${escrows} (${t.escrowLocked.toFixed(4)} SOL locked)`);
        console.log(`  Inflow:    +${t.inflow.toFixed(4)} SOL`);
        console.log(`  Outflow:   -${t.outflow.toFixed(4)} SOL`);
        console.log(`  Earnings:  ${t.agentEarnings.toFixed(4)} SOL (agent payouts)`);
        if (anomalies > 0) {
            console.log(`  ANOMALIES: ${anomalies} flagged`);
        }
        console.log(`  Ledger:    ${LEDGER_FILE}\n`);
    }

    // ─── OWS Unlock Signal ────────────────────────────────────────────────
    // Write a signal file to unlock oracle-bound agents (e.g. Opus)
    // when the cleaning bot confirms funds are clean and verified.
    signalUnlock(agentId) {
        const signalPath = '../data/oracle-unlock.json';
        try {
            const signal = { agent: agentId, ts: Date.now(), source: 'cleaning-bot' };
            fs.writeFileSync(signalPath, JSON.stringify(signal));
            console.log(`[CLEAN] OWS unlock signal sent for ${agentId}`);
        } catch (e) {
            console.log(`[CLEAN] Could not write unlock signal:`, e.message);
        }
    }

    async runCycle() {
        this.cycleCount++;
        console.log(`[CLEAN] ── Scan Cycle #${this.cycleCount} ──`);

        await this.scanTreasury();
        await this.scanAgentAccounts();
        await this.scanEscrows();
        await this.scanRecentTransactions();

        // If no anomalies this cycle, signal Opus unlock
        if (this.ledger.anomalies.length === 0) {
            this.signalUnlock('opus');
        } else {
            console.log(`[CLEAN] Opus remains LOCKED — ${this.ledger.anomalies.length} anomalies`);
        }

        this.ledger.lastScan = new Date().toISOString();
        this.saveLedger();
        this.printSummary();
    }

    start() {
        console.log('[CLEAN] ChAI Cleaning Bot starting...');
        console.log(`[CLEAN] RPC: ${this.rpcUrl}`);
        console.log(`[CLEAN] Treasury: ${TREASURY_SOL}`);
        console.log(`[CLEAN] Registry: ${PROGRAM_ID}`);
        console.log(`[CLEAN] Polling every ${POLL_INTERVAL / 1000}s\n`);

        this.runCycle();
        setInterval(() => this.runCycle(), POLL_INTERVAL);
    }
}

// ─── Run ────────────────────────────────────────────────────────────────────
const bot = new CleaningBot();
bot.start();
