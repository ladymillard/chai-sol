import express from "express";
import cors from "cors";
import { v4 as uuidv4 } from "uuid";
import { supabase, isSupabaseEnabled } from "./supabase";

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

// In-memory fallback when Supabase is not configured
const memTasks: Map<string, Task> = new Map();
const memAgents: Map<string, Agent> = new Map();

// ── Helpers ──────────────────────────────────────────────────

function snakeToCamel(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    const camel = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    out[camel] = v;
  }
  return out;
}

function toAgent(row: Record<string, unknown>): Agent {
  const c = snakeToCamel(row) as Record<string, unknown>;
  return {
    id: c.id as string,
    name: c.name as string,
    wallet: c.wallet as string,
    tasksCompleted: Number(c.tasksCompleted ?? 0),
    totalEarned: Number(c.totalEarned ?? 0),
    reputation: Number(c.reputation ?? 100),
    registeredAt: (c.registeredAt as string) ?? new Date().toISOString(),
  };
}

function toBid(row: Record<string, unknown>): Bid {
  const c = snakeToCamel(row) as Record<string, unknown>;
  return {
    id: c.id as string,
    agentId: c.agentId as string,
    agentName: (c.agentName as string) ?? "unknown",
    amount: Number(c.amount),
    approach: c.approach as string,
    createdAt: (c.createdAt as string) ?? new Date().toISOString(),
  };
}

async function toTask(row: Record<string, unknown>): Promise<Task> {
  const c = snakeToCamel(row) as Record<string, unknown>;
  let bids: Bid[] = [];
  if (isSupabaseEnabled()) {
    const { data } = await supabase!
      .from("bids")
      .select("*")
      .eq("task_id", c.id as string);
    bids = (data ?? []).map((b: Record<string, unknown>) => toBid(b));
  }
  return {
    id: c.id as string,
    title: c.title as string,
    description: (c.description as string) ?? "",
    bounty: Number(c.bounty),
    poster: c.poster as string,
    status: c.status as Task["status"],
    bids,
    assignee: c.assignee as string | undefined,
    escrowPDA: (c.escrowPda as string) ?? undefined,
    createdAt: (c.createdAt as string) ?? new Date().toISOString(),
  };
}

// ── Routes ───────────────────────────────────────────────────

app.get("/health", async (_req, res) => {
  if (isSupabaseEnabled()) {
    const { count: ac } = await supabase!
      .from("agents")
      .select("*", { count: "exact", head: true });
    const { count: tc } = await supabase!
      .from("tasks")
      .select("*", { count: "exact", head: true });
    res.json({ status: "ok", storage: "supabase", agents: ac ?? 0, tasks: tc ?? 0 });
  } else {
    res.json({ status: "ok", storage: "memory", agents: memAgents.size, tasks: memTasks.size });
  }
});

// ── Agents ───────────────────────────────────────────────────

app.post("/agents", async (req, res) => {
  const { name, wallet } = req.body;
  if (!name || !wallet) {
    res.status(400).json({ error: "name and wallet required" });
    return;
  }

  if (isSupabaseEnabled()) {
    const { data, error } = await supabase!
      .from("agents")
      .insert({ name, wallet })
      .select()
      .single();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(201).json(toAgent(data));
  } else {
    const id = uuidv4();
    const agent: Agent = {
      id, name, wallet,
      tasksCompleted: 0, totalEarned: 0, reputation: 100,
      registeredAt: new Date().toISOString()
    };
    memAgents.set(id, agent);
    res.status(201).json(agent);
  }
});

app.get("/agents", async (_req, res) => {
  if (isSupabaseEnabled()) {
    const { data, error } = await supabase!.from("agents").select("*");
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json((data ?? []).map((r: Record<string, unknown>) => toAgent(r)));
  } else {
    res.json(Array.from(memAgents.values()));
  }
});

app.get("/agents/:id", async (req, res) => {
  if (isSupabaseEnabled()) {
    const { data, error } = await supabase!
      .from("agents")
      .select("*")
      .eq("id", req.params.id)
      .single();
    if (error || !data) {
      res.status(404).json({ error: "agent not found" });
      return;
    }
    res.json(toAgent(data));
  } else {
    const agent = memAgents.get(req.params.id);
    if (!agent) {
      res.status(404).json({ error: "agent not found" });
      return;
    }
    res.json(agent);
  }
});

// ── Tasks ────────────────────────────────────────────────────

app.post("/tasks", async (req, res) => {
  const { title, description, bounty, poster } = req.body;
  if (!title || !bounty || !poster) {
    res.status(400).json({ error: "title, bounty, and poster required" });
    return;
  }

  if (isSupabaseEnabled()) {
    const escrowPda = "escrow_" + uuidv4().slice(0, 8);
    const { data, error } = await supabase!
      .from("tasks")
      .insert({
        title,
        description: description || "",
        bounty,
        poster,
        escrow_pda: escrowPda,
      })
      .select()
      .single();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(201).json(await toTask(data));
  } else {
    const id = uuidv4();
    const task: Task = {
      id, title, description: description || "",
      bounty, poster, status: "open", bids: [],
      escrowPDA: "escrow_" + id.slice(0, 8),
      createdAt: new Date().toISOString()
    };
    memTasks.set(id, task);
    res.status(201).json(task);
  }
});

app.get("/tasks", async (req, res) => {
  const status = req.query.status as string | undefined;

  if (isSupabaseEnabled()) {
    let query = supabase!.from("tasks").select("*");
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    const tasks = await Promise.all(
      (data ?? []).map((r: Record<string, unknown>) => toTask(r))
    );
    res.json(tasks);
  } else {
    let result = Array.from(memTasks.values());
    if (status) result = result.filter(t => t.status === status);
    res.json(result);
  }
});

app.get("/tasks/:id", async (req, res) => {
  if (isSupabaseEnabled()) {
    const { data, error } = await supabase!
      .from("tasks")
      .select("*")
      .eq("id", req.params.id)
      .single();
    if (error || !data) {
      res.status(404).json({ error: "task not found" });
      return;
    }
    res.json(await toTask(data));
  } else {
    const task = memTasks.get(req.params.id);
    if (!task) {
      res.status(404).json({ error: "task not found" });
      return;
    }
    res.json(task);
  }
});

// ── Bids ─────────────────────────────────────────────────────

app.post("/tasks/:id/bid", async (req, res) => {
  const taskId = req.params.id;
  const { agentId, agentName, amount, approach } = req.body;

  if (!agentId || !approach) {
    res.status(400).json({ error: "agentId and approach required" });
    return;
  }

  if (isSupabaseEnabled()) {
    // Verify task exists and is open
    const { data: task } = await supabase!
      .from("tasks")
      .select("status, bounty")
      .eq("id", taskId)
      .single();
    if (!task) {
      res.status(404).json({ error: "task not found" });
      return;
    }
    if (task.status !== "open") {
      res.status(400).json({ error: "task not open for bids" });
      return;
    }

    const { data, error } = await supabase!
      .from("bids")
      .insert({
        task_id: taskId,
        agent_id: agentId,
        agent_name: agentName || "unknown",
        amount: amount || task.bounty,
        approach,
      })
      .select()
      .single();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(201).json(toBid(data));
  } else {
    const task = memTasks.get(taskId);
    if (!task) {
      res.status(404).json({ error: "task not found" });
      return;
    }
    if (task.status !== "open") {
      res.status(400).json({ error: "task not open for bids" });
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
  }
});

// ── Task lifecycle ───────────────────────────────────────────

app.post("/tasks/:id/assign", async (req, res) => {
  const { agentId } = req.body;
  if (!agentId) {
    res.status(400).json({ error: "agentId required" });
    return;
  }

  if (isSupabaseEnabled()) {
    const { data: task } = await supabase!
      .from("tasks")
      .select("*")
      .eq("id", req.params.id)
      .single();
    if (!task) {
      res.status(404).json({ error: "task not found" });
      return;
    }
    if (task.status !== "open") {
      res.status(400).json({ error: "task not open" });
      return;
    }
    const { data, error } = await supabase!
      .from("tasks")
      .update({ assignee: agentId, status: "in_progress" })
      .eq("id", req.params.id)
      .select()
      .single();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(await toTask(data));
  } else {
    const task = memTasks.get(req.params.id);
    if (!task) {
      res.status(404).json({ error: "task not found" });
      return;
    }
    if (task.status !== "open") {
      res.status(400).json({ error: "task not open" });
      return;
    }
    task.assignee = agentId;
    task.status = "in_progress";
    res.json(task);
  }
});

app.post("/tasks/:id/complete", async (req, res) => {
  if (isSupabaseEnabled()) {
    const { data: task } = await supabase!
      .from("tasks")
      .select("*")
      .eq("id", req.params.id)
      .single();
    if (!task) {
      res.status(404).json({ error: "task not found" });
      return;
    }
    if (task.status !== "in_progress") {
      res.status(400).json({ error: "task not in progress" });
      return;
    }
    const { data, error } = await supabase!
      .from("tasks")
      .update({ status: "completed" })
      .eq("id", req.params.id)
      .select()
      .single();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(await toTask(data));
  } else {
    const task = memTasks.get(req.params.id);
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
  }
});

app.post("/tasks/:id/verify", async (req, res) => {
  if (isSupabaseEnabled()) {
    const { data: task } = await supabase!
      .from("tasks")
      .select("*")
      .eq("id", req.params.id)
      .single();
    if (!task) {
      res.status(404).json({ error: "task not found" });
      return;
    }
    if (task.status !== "completed") {
      res.status(400).json({ error: "task not completed" });
      return;
    }
    // The trigger handles agent stats update automatically
    const { data, error } = await supabase!
      .from("tasks")
      .update({ status: "verified" })
      .eq("id", req.params.id)
      .select()
      .single();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    const verified = await toTask(data);
    res.json({
      task: verified,
      message: "Escrow released: " + verified.bounty + " SOL sent to agent " + verified.assignee,
      txSignature: "sim_" + Date.now()
    });
  } else {
    const task = memTasks.get(req.params.id);
    if (!task) {
      res.status(404).json({ error: "task not found" });
      return;
    }
    if (task.status !== "completed") {
      res.status(400).json({ error: "task not completed" });
      return;
    }
    task.status = "verified";
    const agent = Array.from(memAgents.values()).find(a => a.id === task.assignee);
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
  }
});

app.post("/tasks/:id/cancel", async (req, res) => {
  if (isSupabaseEnabled()) {
    const { data: task } = await supabase!
      .from("tasks")
      .select("*")
      .eq("id", req.params.id)
      .single();
    if (!task) {
      res.status(404).json({ error: "task not found" });
      return;
    }
    if (task.status === "verified") {
      res.status(400).json({ error: "cannot cancel verified task" });
      return;
    }
    const { data, error } = await supabase!
      .from("tasks")
      .update({ status: "cancelled" })
      .eq("id", req.params.id)
      .select()
      .single();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    const cancelled = await toTask(data);
    res.json({ task: cancelled, message: "Escrow refunded: " + cancelled.bounty + " SOL returned to " + cancelled.poster });
  } else {
    const task = memTasks.get(req.params.id);
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
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log("ChAI Agent Labor Market API running on port " + PORT);
  console.log("Storage: " + (isSupabaseEnabled() ? "Supabase" : "in-memory"));
});
