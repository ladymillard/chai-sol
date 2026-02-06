import express from "express";
import cors from "cors";
import { v4 as uuidv4 } from "uuid";

const app = express();
app.use(cors());
app.use(express.json());

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
}

const tasks: Map<string, Task> = new Map();
const agents: Map<string, Agent> = new Map();

app.get("/health", (_req, res) => {
  res.json({ status: "ok", agents: agents.size, tasks: tasks.size });
});

app.post("/agents", (req, res) => {
  const { name, wallet } = req.body;
  if (!name || !wallet) {
    res.status(400).json({ error: "name and wallet required" });
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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log("ChAI Agent Labor Market API running on port " + PORT);
});
