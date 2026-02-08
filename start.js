#!/usr/bin/env node
// ChAI — Unified Startup Script for Railway
// Starts the backend API, then the combined frontend + proxy server

const { spawn } = require("child_process");
const path = require("path");

const RAILWAY_PORT = process.env.PORT || 8080;
const API_PORT = process.env.API_PORT || 3001;

console.log("=== ChAI Agent Labor Market ===");
console.log(`Environment: ${process.env.RAILWAY_ENVIRONMENT || "local"}`);
console.log(`Public port: ${RAILWAY_PORT}`);
console.log(`API port: ${API_PORT}`);
console.log("");

// Start backend API
const backend = spawn("node", [path.join(__dirname, "backend", "dist", "index.js")], {
  env: { ...process.env, PORT: String(API_PORT) },
  stdio: ["pipe", "pipe", "pipe"]
});

backend.stdout.on("data", (data) => {
  console.log(`[API] ${data.toString().trim()}`);
});

backend.stderr.on("data", (data) => {
  console.error(`[API] ${data.toString().trim()}`);
});

backend.on("error", (err) => {
  console.error("[API] Failed to start backend:", err.message);
});

// Give backend 1s to start, then launch the combined server
setTimeout(() => {
  // Import and start the combined server
  process.env.PORT = String(RAILWAY_PORT);
  process.env.API_PORT = String(API_PORT);
  require("./server.js");
}, 1000);

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received — shutting down...");
  backend.kill("SIGTERM");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("SIGINT received — shutting down...");
  backend.kill("SIGTERM");
  process.exit(0);
});
