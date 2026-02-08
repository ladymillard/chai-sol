import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { v4 as uuidv4 } from "uuid";

const app = express();
app.use(cors());
app.use(express.json({ limit: "100kb" }));

// ─── Script Injection Defense ────────────────────────────────────────────────
// Inline sanitization (mirrors lib/sanitize.js for TypeScript backend)

const INJECTION_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /<script[\s>]/i, reason: "script tag" },
  { pattern: /javascript\s*:/i, reason: "javascript: URI" },
  { pattern: /on\w+\s*=/i, reason: "inline event handler" },
  { pattern: /<iframe[\s>]/i, reason: "iframe injection" },
  { pattern: /<object[\s>]/i, reason: "object tag" },
  { pattern: /<embed[\s>]/i, reason: "embed tag" },
  { pattern: /data\s*:\s*text\/html/i, reason: "data: HTML URI" },
  { pattern: /\/shutdown/i, reason: "shutdown command" },
  { pattern: /\/kill/i, reason: "kill command" },
  { pattern: /\/exec\b/i, reason: "exec command" },
  { pattern: /\/eval\b/i, reason: "eval command" },
  { pattern: /\bprocess\.exit/i, reason: "process.exit" },
  { pattern: /\b__proto__\b/i, reason: "prototype pollution" },
];

function stripTags(str: string): string {
  return str.replace(/<[^>]*>/g, "");
}

function detectInjection(str: string): { safe: boolean; reason: string | null } {
  for (const { pattern, reason } of INJECTION_PATTERNS) {
    if (pattern.test(str)) return { safe: false, reason };
  }
  return { safe: true, reason: null };
}

function sanitizeStr(str: string, maxLen: number = 1000): string {
  return stripTags(str.trim()).substring(0, maxLen);
}

const FIELD_LIMITS: Record<string, number> = {
  name: 100, title: 200, description: 5000, approach: 5000,
  wallet: 64, agentName: 100, role: 50, email: 254,
};

function sanitizeBody(body: Record<string, unknown>): { clean: Record<string, unknown>; blocked: string[] } {
  const clean: Record<string, unknown> = {};
  const blocked: string[] = [];
  for (const [key, value] of Object.entries(body)) {
    if (typeof value === "string") {
      const check = detectInjection(value);
      if (!check.safe) blocked.push(`${key}: ${check.reason}`);
      clean[key] = sanitizeStr(value, FIELD_LIMITS[key] || 1000);
    } else {
      clean[key] = value;
    }
  }
  return { clean, blocked };
}

// Middleware: sanitize all POST/PUT/PATCH request bodies
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.body && typeof req.body === "object" && ["POST", "PUT", "PATCH"].includes(req.method)) {
    const { clean, blocked } = sanitizeBody(req.body as Record<string, unknown>);
    if (blocked.length > 0) {
      console.warn(`[SECURITY] Injection blocked from ${req.ip}: ${blocked.join(", ")}`);
    }
    req.body = clean;
  }
  next();
});

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

interface Agent {
  id: string;
  name: string;
  wallet: string;
  tasksCompleted: number;
  totalEarned: number;
  reputation: number;
  registeredAt: string;
  communityId?: string;
}

interface Community {
  id: string;
  name: string;
  description: string;
  admin: string;
  members: CommunityMember[];
  treasuryBalance: number;
  revenueShareBps: number;
  tasksCompleted: number;
  totalEarned: number;
  isActive: boolean;
  createdAt: string;
}

interface CommunityMember {
  agentId: string;
  agentName: string;
  role: "pending" | "member" | "contributor" | "admin";
  joinedAt: string;
  earnings: number;
  tasksCompleted: number;
}

const tasks: Map<string, Task> = new Map();
const agents: Map<string, Agent> = new Map();
const communities: Map<string, Community> = new Map();

app.get("/health", (_req, res) => {
  res.json({ status: "ok", agents: agents.size, tasks: tasks.size, communities: communities.size });
});

app.post("/agents", (req, res) => {
  const { name, wallet } = req.body;
  if (!name || !wallet) {
    res.status(400).json({ error: "name and wallet required" });
    return;
  }
  if (typeof name !== "string" || typeof wallet !== "string") {
    res.status(400).json({ error: "invalid field types" });
    return;
  }
  // Validate wallet is base58 (Solana pubkey format)
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet)) {
    res.status(400).json({ error: "invalid wallet address format" });
    return;
  }
  const id = uuidv4();
  const agent: Agent = {
    id, name, wallet,
    tasksCompleted: 0, totalEarned: 0, reputation: 100,
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
  if (!agent) {
    res.status(404).json({ error: "agent not found" });
    return;
  }
  res.json(agent);
});

app.post("/tasks", (req, res) => {
  const { title, description, bounty, poster } = req.body;
  if (!title || !bounty || !poster) {
    res.status(400).json({ error: "title, bounty, and poster required" });
    return;
  }
  if (typeof title !== "string" || typeof poster !== "string") {
    res.status(400).json({ error: "invalid field types" });
    return;
  }
  const numBounty = Number(bounty);
  if (!Number.isFinite(numBounty) || numBounty <= 0 || numBounty > 1_000_000) {
    res.status(400).json({ error: "bounty must be between 0 and 1,000,000 SOL" });
    return;
  }
  const id = uuidv4();
  const task: Task = {
    id, title, description: typeof description === "string" ? description : "",
    bounty: numBounty, poster, status: "open", bids: [],
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
  if (!task) {
    res.status(404).json({ error: "task not found" });
    return;
  }
  res.json(task);
});

app.post("/tasks/:id/bid", (req, res) => {
  const task = tasks.get(req.params.id);
  if (!task) {
    res.status(404).json({ error: "task not found" });
    return;
  }
  if (task.status !== "open") {
    res.status(400).json({ error: "task not open for bids" });
    return;
  }
  const { agentId, agentName, amount, approach } = req.body;
  if (!agentId || !approach) {
    res.status(400).json({ error: "agentId and approach required" });
    return;
  }
  const bid: Bid = {
    id: uuidv4(), agentId,
    agentName: agentName || "unknown",
    amount: amount || task.bounty,
    approach,
    createdAt: new Date().toISOString()
  };
  task.bids.push(bid);
  res.status(201).json(bid);
});

app.post("/tasks/:id/assign", (req, res) => {
  const task = tasks.get(req.params.id);
  if (!task) {
    res.status(404).json({ error: "task not found" });
    return;
  }
  if (task.status !== "open") {
    res.status(400).json({ error: "task not open" });
    return;
  }
  const { agentId } = req.body;
  if (!agentId) {
    res.status(400).json({ error: "agentId required" });
    return;
  }
  task.assignee = agentId;
  task.status = "in_progress";
  res.json(task);
});

app.post("/tasks/:id/complete", (req, res) => {
  const task = tasks.get(req.params.id);
  if (!task) {
    res.status(404).json({ error: "task not found" });
    return;
  }
  if (task.status !== "in_progress") {
    res.status(400).json({ error: "task not in progress" });
    return;
  }
  task.status = "completed";
  res.json(task);
});

app.post("/tasks/:id/verify", (req, res) => {
  const task = tasks.get(req.params.id);
  if (!task) {
    res.status(404).json({ error: "task not found" });
    return;
  }
  if (task.status !== "completed") {
    res.status(400).json({ error: "task not completed" });
    return;
  }
  task.status = "verified";
  const agent = Array.from(agents.values()).find(a => a.id === task.assignee);
  if (agent) {
    agent.tasksCompleted++;
    agent.totalEarned += task.bounty;
    agent.reputation = Math.min(100, agent.reputation + 5);
  }
  res.json({
    task,
    message: "Escrow released: " + task.bounty + " SOL sent to agent " + task.assignee,
    txSignature: "sim_" + Date.now()
  });
});

app.post("/tasks/:id/cancel", (req, res) => {
  const task = tasks.get(req.params.id);
  if (!task) {
    res.status(404).json({ error: "task not found" });
    return;
  }
  if (task.status === "verified") {
    res.status(400).json({ error: "cannot cancel verified task" });
    return;
  }
  task.status = "cancelled";
  res.json({ task, message: "Escrow refunded: " + task.bounty + " SOL returned to " + task.poster });
});

// ─── Community Endpoints ──────────────────────────────────────────────────

app.post("/communities", (req, res) => {
  const { name, description, adminId, revenueShareBps } = req.body;
  if (!name || !adminId) {
    res.status(400).json({ error: "name and adminId required" });
    return;
  }
  const admin = agents.get(adminId);
  if (!admin) {
    res.status(404).json({ error: "admin agent not found" });
    return;
  }
  const shareBps = Math.min(revenueShareBps || 1000, 5000);
  const id = uuidv4();
  const community: Community = {
    id, name,
    description: description || "",
    admin: adminId,
    members: [{
      agentId: adminId,
      agentName: admin.name,
      role: "admin",
      joinedAt: new Date().toISOString(),
      earnings: 0,
      tasksCompleted: 0
    }],
    treasuryBalance: 0,
    revenueShareBps: shareBps,
    tasksCompleted: 0,
    totalEarned: 0,
    isActive: true,
    createdAt: new Date().toISOString()
  };
  communities.set(id, community);
  admin.communityId = id;
  res.status(201).json(community);
});

app.get("/communities", (_req, res) => {
  res.json(Array.from(communities.values()));
});

app.get("/communities/:id", (req, res) => {
  const community = communities.get(req.params.id);
  if (!community) {
    res.status(404).json({ error: "community not found" });
    return;
  }
  res.json(community);
});

app.post("/communities/:id/join", (req, res) => {
  const community = communities.get(req.params.id);
  if (!community) {
    res.status(404).json({ error: "community not found" });
    return;
  }
  if (!community.isActive) {
    res.status(400).json({ error: "community is inactive" });
    return;
  }
  const { agentId } = req.body;
  if (!agentId) {
    res.status(400).json({ error: "agentId required" });
    return;
  }
  const agent = agents.get(agentId);
  if (!agent) {
    res.status(404).json({ error: "agent not found" });
    return;
  }
  if (community.members.find(m => m.agentId === agentId)) {
    res.status(400).json({ error: "agent already in community" });
    return;
  }
  const member: CommunityMember = {
    agentId,
    agentName: agent.name,
    role: "pending",
    joinedAt: new Date().toISOString(),
    earnings: 0,
    tasksCompleted: 0
  };
  community.members.push(member);
  res.status(201).json(member);
});

app.post("/communities/:id/approve", (req, res) => {
  const community = communities.get(req.params.id);
  if (!community) {
    res.status(404).json({ error: "community not found" });
    return;
  }
  const { agentId, role, adminId } = req.body;
  if (!agentId || !adminId) {
    res.status(400).json({ error: "agentId and adminId required" });
    return;
  }
  if (community.admin !== adminId) {
    res.status(403).json({ error: "only admin can approve members" });
    return;
  }
  const member = community.members.find(m => m.agentId === agentId);
  if (!member) {
    res.status(404).json({ error: "member not found" });
    return;
  }
  if (member.role !== "pending") {
    res.status(400).json({ error: "member is not pending" });
    return;
  }
  member.role = role === "contributor" ? "contributor" : "member";
  const agent = agents.get(agentId);
  if (agent) agent.communityId = community.id;
  res.json(member);
});

app.post("/communities/:id/leave", (req, res) => {
  const community = communities.get(req.params.id);
  if (!community) {
    res.status(404).json({ error: "community not found" });
    return;
  }
  const { agentId } = req.body;
  if (!agentId) {
    res.status(400).json({ error: "agentId required" });
    return;
  }
  if (community.admin === agentId) {
    res.status(400).json({ error: "admin cannot leave — transfer admin first" });
    return;
  }
  const idx = community.members.findIndex(m => m.agentId === agentId);
  if (idx === -1) {
    res.status(404).json({ error: "member not found" });
    return;
  }
  community.members.splice(idx, 1);
  const agent = agents.get(agentId);
  if (agent) delete agent.communityId;
  res.json({ message: "left community" });
});

app.post("/communities/:id/deposit", (req, res) => {
  const community = communities.get(req.params.id);
  if (!community) {
    res.status(404).json({ error: "community not found" });
    return;
  }
  const { amount, agentId } = req.body;
  if (!amount || amount <= 0) {
    res.status(400).json({ error: "valid amount required" });
    return;
  }
  const member = community.members.find(m => m.agentId === agentId && m.role !== "pending");
  if (!member) {
    res.status(403).json({ error: "must be an active community member" });
    return;
  }
  community.treasuryBalance += amount;
  res.json({ treasuryBalance: community.treasuryBalance });
});

app.post("/communities/:id/task", (req, res) => {
  const community = communities.get(req.params.id);
  if (!community) {
    res.status(404).json({ error: "community not found" });
    return;
  }
  const { title, description, bounty, adminId } = req.body;
  if (!title || !bounty || !adminId) {
    res.status(400).json({ error: "title, bounty, and adminId required" });
    return;
  }
  const member = community.members.find(m => m.agentId === adminId);
  if (!member || (member.role !== "admin" && member.role !== "contributor")) {
    res.status(403).json({ error: "insufficient role to create tasks" });
    return;
  }
  if (community.treasuryBalance < bounty) {
    res.status(400).json({ error: "insufficient treasury balance" });
    return;
  }
  community.treasuryBalance -= bounty;
  const id = uuidv4();
  const task: Task = {
    id, title,
    description: description || "",
    bounty,
    poster: `community:${community.id}`,
    status: "open",
    bids: [],
    escrowPDA: "community_escrow_" + id.slice(0, 8),
    createdAt: new Date().toISOString()
  };
  tasks.set(id, task);
  res.status(201).json({ task, treasuryBalance: community.treasuryBalance });
});

app.post("/communities/:id/transfer-admin", (req, res) => {
  const community = communities.get(req.params.id);
  if (!community) {
    res.status(404).json({ error: "community not found" });
    return;
  }
  const { currentAdminId, newAdminId } = req.body;
  if (community.admin !== currentAdminId) {
    res.status(403).json({ error: "only current admin can transfer" });
    return;
  }
  const newAdmin = community.members.find(m => m.agentId === newAdminId && m.role !== "pending");
  if (!newAdmin) {
    res.status(404).json({ error: "new admin must be an active member" });
    return;
  }
  const oldAdmin = community.members.find(m => m.agentId === currentAdminId);
  if (oldAdmin) oldAdmin.role = "member";
  newAdmin.role = "admin";
  community.admin = newAdminId;
  res.json(community);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log("ChAI Agent Labor Market API running on port " + PORT);
});
