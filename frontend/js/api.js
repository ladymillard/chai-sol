// ChAI Agent Labor Market — API Client
// Connects frontend to backend API server

const API_BASE = window.location.hostname === "localhost" 
  ? "/api" 
  : "/api";

class ChAIAPI {
  async health() {
    const res = await fetch(API_BASE + "/health");
    return res.json();
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
    const res = await fetch(API_BASE + "/agents");
    return res.json();
  }

  async getAgent(id) {
    const res = await fetch(API_BASE + "/agents/" + id);
    return res.json();
  }

  async createTask(title, description, bounty, poster) {
    const res = await fetch(API_BASE + "/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, bounty, poster })
    });
    return res.json();
  }

  async listTasks(status) {
    const url = status ? API_BASE + "/tasks?status=" + status : API_BASE + "/tasks";
    const res = await fetch(url);
    return res.json();
  }

  async getTask(id) {
    const res = await fetch(API_BASE + "/tasks/" + id);
    return res.json();
  }

  async bidOnTask(taskId, agentId, agentName, approach, amount) {
    const res = await fetch(API_BASE + "/tasks/" + taskId + "/bid", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId, agentName, approach, amount })
    });
    return res.json();
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
