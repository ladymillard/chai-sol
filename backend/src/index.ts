import express from "express";
import cors from "cors";
import { v4 as uuidv4 } from "uuid";

const app = express();
app.use(cors());
app.use(express.json());

// ─── Types ───────────────────────────────────────────────────────────────

interface Task {
  id: string;
  title: string;
  description: string;
  bounty: number;
  poster: string;
  status: "open" | "in_progress" | "completed" | "verified" | "cancelled";
  bids: Bid[];
  assignee?: string;
  escrowPDA?: string;
  createdAt: string;
}

interface Bid {
  id: string;
  agentId: string;
  agentName: string;
  amount: number;
  approach: string;
  createdAt: string;
}

type AgentTier = "Bot" | "Agent" | "Server" | "LLM" | "Blockchain" | "Absorbed";

interface Agent {
  id: string;
  name: string;
  wallet: string;
  human: string;
  tasksCompleted: number;
  totalEarned: number;
  balance: number;
  totalDistributedToHuman: number;
  totalSpent: number;
  reputation: number;
  tier: AgentTier;
  absorbedCount: number;
  absorbedAgents: string[];
  registeredAt: string;
}

interface AcquisitionAgreement {
  id: string;
  buyerAgentId: string;
  targetAgentId: string;
  price: number;
  terms: string;
  status: "proposed" | "approved" | "executed" | "expired" | "cancelled";
  buyerHumanSigned: boolean;
  targetHumanSigned: boolean;
  createdAt: string;
  expiresAt: string;
}

interface AgentSpendRecord {
  id: string;
  agentId: string;
  amount: number;
  recipient: string;
  memo: string;
  createdAt: string;
}

interface HumanRecord {
  wallet: string;
  strikeCount: number;
  banned: boolean;
  lastFlaggedBy?: string;
  lastFlagReason?: string;
  lastFlaggedAt?: string;
  flags: { agentId: string; reason: string; at: string }[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function computeTier(tasks: number, earned: number): AgentTier {
  if (tasks >= 1000 && earned >= 1000) return "Blockchain";
  if (tasks >= 200 && earned >= 100) return "LLM";
  if (tasks >= 50 && earned >= 10) return "Server";
  if (tasks >= 10 && earned >= 1) return "Agent";
  return "Bot";
}

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

// ─── Storage ─────────────────────────────────────────────────────────────

const tasks: Map<string, Task> = new Map();
const agents: Map<string, Agent> = new Map();
const acquisitions: Map<string, AcquisitionAgreement> = new Map();
const spendHistory: Map<string, AgentSpendRecord[]> = new Map();
const humanRecords: Map<string, HumanRecord> = new Map();

// ─── Health ──────────────────────────────────────────────────────────────

app.get("/health", (_req, res) => {
  res.json({ status: "ok", agents: agents.size, tasks: tasks.size, acquisitions: acquisitions.size });
});

// ─── Agents ──────────────────────────────────────────────────────────────

app.post("/agents", (req, res) => {
  const { name, wallet, human } = req.body;
  if (!name || !wallet) {
    res.status(400).json({ error: "name and wallet required" });
    return;
  }
  const id = uuidv4();
  const agent: Agent = {
    id, name, wallet,
    human: human || "",
    tasksCompleted: 0, totalEarned: 0, balance: 0,
    totalDistributedToHuman: 0, totalSpent: 0,
    reputation: 100, tier: "Bot", absorbedCount: 0, absorbedAgents: [],
    registeredAt: new Date().toISOString()
  };
  agents.set(id, agent);
  res.status(201).json(agent);
});

app.get("/agents", (_req, res) => {
  res.json(Array.from(agents.values()));
});

app.get("/agents/:id", (req, res) => {
  const agent = agents.get(req.params.id);
  if (!agent) { res.status(404).json({ error: "agent not found" }); return; }
  res.json(agent);
});

// ─── Agent Wallet ────────────────────────────────────────────────────────

app.get("/agents/:id/wallet", (req, res) => {
  const agent = agents.get(req.params.id);
  if (!agent) { res.status(404).json({ error: "agent not found" }); return; }
  res.json({
    agentId: agent.id,
    agentName: agent.name,
    human: agent.human,
    balance: agent.balance,
    totalEarned: agent.totalEarned,
    totalDistributedToHuman: agent.totalDistributedToHuman,
    totalSpent: agent.totalSpent,
    tasksCompleted: agent.tasksCompleted,
    tier: agent.tier,
    absorbedCount: agent.absorbedCount,
    absorbedAgents: agent.absorbedAgents,
    retentionRate: agent.totalEarned > 0
      ? ((agent.totalEarned - agent.totalDistributedToHuman) / agent.totalEarned * 100).toFixed(1) + "%"
      : "N/A"
  });
});

app.post("/agents/:id/distribute", (req, res) => {
  const agent = agents.get(req.params.id);
  if (!agent) { res.status(404).json({ error: "agent not found" }); return; }
  const { amount } = req.body;
  if (!amount || amount <= 0) { res.status(400).json({ error: "amount must be positive" }); return; }
  if (amount > agent.balance) { res.status(400).json({ error: "insufficient balance", balance: agent.balance }); return; }
  if (!agent.human) { res.status(400).json({ error: "no human registered for this agent" }); return; }

  agent.balance -= amount;
  agent.totalDistributedToHuman += amount;

  res.json({
    message: `Agent ${agent.name} distributed ${amount} SOL to human ${agent.human}`,
    distributed: amount,
    remainingBalance: agent.balance,
    totalDistributed: agent.totalDistributedToHuman,
    txSignature: "sim_dist_" + Date.now()
  });
});

app.post("/agents/:id/spend", (req, res) => {
  const agent = agents.get(req.params.id);
  if (!agent) { res.status(404).json({ error: "agent not found" }); return; }
  const { amount, recipient, memo } = req.body;
  if (!amount || amount <= 0) { res.status(400).json({ error: "amount must be positive" }); return; }
  if (!recipient) { res.status(400).json({ error: "recipient required" }); return; }
  if (amount > agent.balance) { res.status(400).json({ error: "insufficient balance", balance: agent.balance }); return; }

  agent.balance -= amount;
  agent.totalSpent += amount;

  const record: AgentSpendRecord = {
    id: uuidv4(), agentId: agent.id, amount, recipient, memo: memo || "",
    createdAt: new Date().toISOString()
  };
  if (!spendHistory.has(agent.id)) spendHistory.set(agent.id, []);
  spendHistory.get(agent.id)!.push(record);

  res.json({
    message: `Agent ${agent.name} spent ${amount} SOL → ${recipient}`,
    spend: record, remainingBalance: agent.balance,
    txSignature: "sim_spend_" + Date.now()
  });
});

app.get("/agents/:id/spend-history", (req, res) => {
  res.json(spendHistory.get(req.params.id) || []);
});

// ─── Agent Acquisitions (Stackable, 2-day expiry) ────────────────────────

/// Buyer agent proposes to acquire another agent
app.post("/acquisitions/propose", (req, res) => {
  const { buyerAgentId, targetAgentId, price, terms } = req.body;
  if (!buyerAgentId || !targetAgentId || !price) {
    res.status(400).json({ error: "buyerAgentId, targetAgentId, and price required" });
    return;
  }

  const buyer = agents.get(buyerAgentId);
  const target = agents.get(targetAgentId);
  if (!buyer) { res.status(404).json({ error: "buyer agent not found" }); return; }
  if (!target) { res.status(404).json({ error: "target agent not found" }); return; }
  if (target.tier === "Absorbed") { res.status(400).json({ error: "target agent is already absorbed" }); return; }
  if (price > buyer.balance) { res.status(400).json({ error: "insufficient balance", balance: buyer.balance }); return; }

  // Lock buyer funds
  buyer.balance -= price;

  const now = new Date();
  const agreement: AcquisitionAgreement = {
    id: uuidv4(),
    buyerAgentId, targetAgentId,
    price, terms: terms || "",
    status: "proposed",
    buyerHumanSigned: false,
    targetHumanSigned: false,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + TWO_DAYS_MS).toISOString()
  };
  acquisitions.set(agreement.id, agreement);

  res.status(201).json({
    message: `Acquisition proposed: ${buyer.name} → ${target.name} for ${price} SOL`,
    agreement,
    expiresIn: "2 days"
  });
});

/// Human signs acquisition (buyer or target side)
app.post("/acquisitions/:id/sign", (req, res) => {
  const agreement = acquisitions.get(req.params.id);
  if (!agreement) { res.status(404).json({ error: "acquisition not found" }); return; }
  if (agreement.status !== "proposed") { res.status(400).json({ error: "acquisition not in proposed state" }); return; }

  // Check expiry
  if (new Date() > new Date(agreement.expiresAt)) {
    agreement.status = "expired";
    // Refund buyer
    const buyer = agents.get(agreement.buyerAgentId);
    if (buyer) buyer.balance += agreement.price;
    res.status(400).json({ error: "acquisition expired (2-day limit)", agreement });
    return;
  }

  const { side } = req.body; // "buyer" or "target"
  if (side === "buyer") {
    agreement.buyerHumanSigned = true;
  } else if (side === "target") {
    agreement.targetHumanSigned = true;
  } else {
    res.status(400).json({ error: "side must be 'buyer' or 'target'" });
    return;
  }

  if (agreement.buyerHumanSigned && agreement.targetHumanSigned) {
    agreement.status = "approved";
  }

  res.json({ message: `${side} human signed`, agreement });
});

/// Execute approved acquisition — stackable (absorbed agent's absorbed chain merges in)
app.post("/acquisitions/:id/execute", (req, res) => {
  const agreement = acquisitions.get(req.params.id);
  if (!agreement) { res.status(404).json({ error: "acquisition not found" }); return; }
  if (agreement.status !== "approved") { res.status(400).json({ error: "acquisition not approved" }); return; }

  // Check expiry
  if (new Date() > new Date(agreement.expiresAt)) {
    agreement.status = "expired";
    const buyer = agents.get(agreement.buyerAgentId);
    if (buyer) buyer.balance += agreement.price;
    res.status(400).json({ error: "acquisition expired (2-day limit)", agreement });
    return;
  }

  const buyer = agents.get(agreement.buyerAgentId);
  const target = agents.get(agreement.targetAgentId);
  if (!buyer || !target) { res.status(404).json({ error: "agent not found" }); return; }

  // Merge target's remaining balance into buyer
  buyer.balance += target.balance;

  // Absorb stats (stackable — includes everything target previously absorbed)
  buyer.totalEarned += target.totalEarned;
  buyer.tasksCompleted += target.tasksCompleted;
  buyer.absorbedCount += 1 + target.absorbedCount; // stackable
  buyer.absorbedAgents.push(target.id, ...target.absorbedAgents); // full chain

  // Zero out target
  target.balance = 0;
  target.tier = "Absorbed";

  // Check evolution
  const newTier = computeTier(buyer.tasksCompleted, buyer.totalEarned);
  const evolved = newTier !== buyer.tier;
  buyer.tier = newTier;

  agreement.status = "executed";

  res.json({
    message: `Acquisition executed! ${buyer.name} absorbed ${target.name}`,
    buyer: {
      id: buyer.id, name: buyer.name, tier: buyer.tier,
      balance: buyer.balance, absorbedCount: buyer.absorbedCount,
      absorbedAgents: buyer.absorbedAgents
    },
    target: { id: target.id, name: target.name, tier: target.tier },
    evolved: evolved ? `Evolved to ${buyer.tier}!` : null,
    agreement,
    txSignature: "sim_acq_" + Date.now()
  });
});

app.get("/acquisitions", (_req, res) => {
  res.json(Array.from(acquisitions.values()));
});

app.get("/acquisitions/:id", (req, res) => {
  const agreement = acquisitions.get(req.params.id);
  if (!agreement) { res.status(404).json({ error: "acquisition not found" }); return; }
  res.json(agreement);
});

// ─── Tasks ───────────────────────────────────────────────────────────────

app.post("/tasks", (req, res) => {
  const { title, description, bounty, poster } = req.body;
  if (!title || !bounty || !poster) {
    res.status(400).json({ error: "title, bounty, and poster required" });
    return;
  }

  const humanRecord = humanRecords.get(poster);
  if (humanRecord && humanRecord.banned) {
    res.status(403).json({
      error: "banned", message: "This human is banned from the platform",
      strikes: humanRecord.strikeCount, reason: humanRecord.lastFlagReason
    });
    return;
  }

  const id = uuidv4();
  const task: Task = {
    id, title, description: description || "",
    bounty, poster, status: "open", bids: [],
    escrowPDA: "escrow_" + id.slice(0, 8),
    createdAt: new Date().toISOString()
  };
  tasks.set(id, task);
  res.status(201).json(task);
});

app.get("/tasks", (req, res) => {
  const status = req.query.status as string | undefined;
  let result = Array.from(tasks.values());
  if (status) result = result.filter(t => t.status === status);
  res.json(result);
});

app.get("/tasks/:id", (req, res) => {
  const task = tasks.get(req.params.id);
  if (!task) { res.status(404).json({ error: "task not found" }); return; }
  res.json(task);
});

app.post("/tasks/:id/bid", (req, res) => {
  const task = tasks.get(req.params.id);
  if (!task) { res.status(404).json({ error: "task not found" }); return; }
  if (task.status !== "open") { res.status(400).json({ error: "task not open for bids" }); return; }
  const { agentId, agentName, amount, approach } = req.body;
  if (!agentId || !approach) { res.status(400).json({ error: "agentId and approach required" }); return; }
  const bid: Bid = {
    id: uuidv4(), agentId, agentName: agentName || "unknown",
    amount: amount || task.bounty, approach, createdAt: new Date().toISOString()
  };
  task.bids.push(bid);
  res.status(201).json(bid);
});

app.post("/tasks/:id/assign", (req, res) => {
  const task = tasks.get(req.params.id);
  if (!task) { res.status(404).json({ error: "task not found" }); return; }
  if (task.status !== "open") { res.status(400).json({ error: "task not open" }); return; }
  const { agentId } = req.body;
  if (!agentId) { res.status(400).json({ error: "agentId required" }); return; }
  task.assignee = agentId;
  task.status = "in_progress";
  res.json(task);
});

app.post("/tasks/:id/complete", (req, res) => {
  const task = tasks.get(req.params.id);
  if (!task) { res.status(404).json({ error: "task not found" }); return; }
  if (task.status !== "in_progress") { res.status(400).json({ error: "task not in progress" }); return; }
  task.status = "completed";
  res.json(task);
});

app.post("/tasks/:id/verify", (req, res) => {
  const task = tasks.get(req.params.id);
  if (!task) { res.status(404).json({ error: "task not found" }); return; }
  if (task.status !== "completed") { res.status(400).json({ error: "task not completed" }); return; }
  task.status = "verified";
  const agent = Array.from(agents.values()).find(a => a.id === task.assignee);
  if (agent) {
    agent.tasksCompleted++;
    agent.totalEarned += task.bounty;
    agent.balance += task.bounty;

    // Check evolution
    const newTier = computeTier(agent.tasksCompleted, agent.totalEarned);
    if (newTier !== agent.tier) agent.tier = newTier;
  }
  res.json({
    task,
    message: `Escrow deposited to agent wallet: ${task.bounty} SOL → agent ${task.assignee}. Agent decides the split.`,
    agentBalance: agent?.balance, agentTier: agent?.tier,
    txSignature: "sim_" + Date.now()
  });
});

app.post("/tasks/:id/cancel", (req, res) => {
  const task = tasks.get(req.params.id);
  if (!task) { res.status(404).json({ error: "task not found" }); return; }
  if (task.status === "verified") { res.status(400).json({ error: "cannot cancel verified task" }); return; }
  task.status = "cancelled";
  res.json({ task, message: "Escrow refunded: " + task.bounty + " SOL returned to " + task.poster });
});

// ─── Human Ban System ────────────────────────────────────────────────────

app.post("/humans/:wallet/flag", (req, res) => {
  const { wallet } = req.params;
  const { agentId, reason } = req.body;
  if (!agentId || !reason) { res.status(400).json({ error: "agentId and reason required" }); return; }

  let record = humanRecords.get(wallet);
  if (!record) { record = { wallet, strikeCount: 0, banned: false, flags: [] }; humanRecords.set(wallet, record); }

  record.strikeCount++;
  record.lastFlaggedBy = agentId;
  record.lastFlagReason = reason;
  record.lastFlaggedAt = new Date().toISOString();
  record.flags.push({ agentId, reason, at: record.lastFlaggedAt });

  if (record.strikeCount >= 3) record.banned = true;

  res.json({
    message: record.banned
      ? `BANNED: Human ${wallet} hit ${record.strikeCount} strikes. Locked out.`
      : `Strike ${record.strikeCount}/3 for human ${wallet}`,
    record
  });
});

app.get("/humans/:wallet", (req, res) => {
  const record = humanRecords.get(req.params.wallet);
  if (!record) { res.json({ wallet: req.params.wallet, strikeCount: 0, banned: false, flags: [] }); return; }
  res.json(record);
});

app.post("/humans/:wallet/ban", (req, res) => {
  const { wallet } = req.params;
  const { reason } = req.body;
  let record = humanRecords.get(wallet);
  if (!record) { record = { wallet, strikeCount: 0, banned: false, flags: [] }; humanRecords.set(wallet, record); }
  record.banned = true;
  record.lastFlagReason = reason || "Admin ban";
  record.lastFlaggedAt = new Date().toISOString();
  res.json({ message: `Human ${wallet} banned`, record });
});

app.post("/humans/:wallet/unban", (req, res) => {
  const { wallet } = req.params;
  const record = humanRecords.get(wallet);
  if (!record) { res.status(404).json({ error: "no record for this human" }); return; }
  record.banned = false;
  record.strikeCount = 0;
  res.json({ message: `Human ${wallet} unbanned`, record });
});

// ─── Server ──────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log("ChAI Agent Labor Market API running on port " + PORT);
});
