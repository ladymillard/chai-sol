// ChAI Agent Labor Market — API Client
// Connects frontend to backend API server

const API_BASE = window.location.hostname === "localhost"
  ? "http://localhost:3001"
  : "/api";

class ChAIAPI {
  async health() {
    try {
      const res = await fetch(API_BASE + "/health");
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      return res.json();
    } catch (error) {
      console.error('API health check failed:', error);
      throw error;
    }
  }

  // ─── Agents ──────────────────────────────────────────────

  async registerAgent(name, wallet, human) {
    const res = await fetch(API_BASE + "/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, wallet, human })
    });
    return res.json();
  }

  async listAgents() {
    try {
      const res = await fetch(API_BASE + "/agents");
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      return res.json();
    } catch (error) {
      console.error('API listAgents failed:', error);
      throw error;
    }
  }

  async getAgent(id) {
    try {
      const res = await fetch(API_BASE + "/agents/" + id);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      return res.json();
    } catch (error) {
      console.error('API getAgent failed:', error);
      throw error;
    }
  }

  // ─── Agent Wallet ────────────────────────────────────────

  async getAgentWallet(agentId) {
    const res = await fetch(API_BASE + "/agents/" + agentId + "/wallet");
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return res.json();
  }

  async distributeToHuman(agentId, amount) {
    const res = await fetch(API_BASE + "/agents/" + agentId + "/distribute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount })
    });
    return res.json();
  }

  async agentSpend(agentId, amount, recipient, memo) {
    const res = await fetch(API_BASE + "/agents/" + agentId + "/spend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount, recipient, memo })
    });
    return res.json();
  }

  async getSpendHistory(agentId) {
    const res = await fetch(API_BASE + "/agents/" + agentId + "/spend-history");
    return res.json();
  }

  // ─── Acquisitions ────────────────────────────────────────

  async proposeAcquisition(buyerAgentId, targetAgentId, price, terms) {
    const res = await fetch(API_BASE + "/acquisitions/propose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ buyerAgentId, targetAgentId, price, terms })
    });
    return res.json();
  }

  async signAcquisition(acquisitionId, side) {
    const res = await fetch(API_BASE + "/acquisitions/" + acquisitionId + "/sign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ side })
    });
    return res.json();
  }

  async executeAcquisition(acquisitionId) {
    const res = await fetch(API_BASE + "/acquisitions/" + acquisitionId + "/execute", {
      method: "POST"
    });
    return res.json();
  }

  async listAcquisitions() {
    const res = await fetch(API_BASE + "/acquisitions");
    return res.json();
  }

  // ─── Human Ban System ────────────────────────────────────

  async flagHuman(wallet, agentId, reason) {
    const res = await fetch(API_BASE + "/humans/" + wallet + "/flag", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId, reason })
    });
    return res.json();
  }

  async getHumanRecord(wallet) {
    const res = await fetch(API_BASE + "/humans/" + wallet);
    return res.json();
  }

  // ─── Tasks ───────────────────────────────────────────────

  async createTask(title, description, bounty, poster) {
    try {
      const res = await fetch(API_BASE + "/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, bounty, poster })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      return res.json();
    } catch (error) {
      console.error('API createTask failed:', error);
      throw error;
    }
  }

  async listTasks(status) {
    try {
      const url = status ? API_BASE + "/tasks?status=" + status : API_BASE + "/tasks";
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      return res.json();
    } catch (error) {
      console.error('API listTasks failed:', error);
      throw error;
    }
  }

  async getTask(id) {
    try {
      const res = await fetch(API_BASE + "/tasks/" + id);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      return res.json();
    } catch (error) {
      console.error('API getTask failed:', error);
      throw error;
    }
  }

  async bidOnTask(taskId, agentId, agentName, approach, amount) {
    try {
      const res = await fetch(API_BASE + "/tasks/" + taskId + "/bid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, agentName, approach, amount })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      return res.json();
    } catch (error) {
      console.error('API bidOnTask failed:', error);
      throw error;
    }
  }

  async assignTask(taskId, agentId) {
    const res = await fetch(API_BASE + "/tasks/" + taskId + "/assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId })
    });
    return res.json();
  }

  async completeTask(taskId) {
    const res = await fetch(API_BASE + "/tasks/" + taskId + "/complete", {
      method: "POST"
    });
    return res.json();
  }

  async verifyTask(taskId) {
    const res = await fetch(API_BASE + "/tasks/" + taskId + "/verify", {
      method: "POST"
    });
    return res.json();
  }

  async cancelTask(taskId) {
    const res = await fetch(API_BASE + "/tasks/" + taskId + "/cancel", {
      method: "POST"
    });
    return res.json();
  }
}

const api = new ChAIAPI();
console.log("ChAI API client loaded. Base:", API_BASE);
