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

  async registerAgent(name, wallet) {
    const res = await fetch(API_BASE + "/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, wallet })
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
