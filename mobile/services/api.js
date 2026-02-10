// ============================================================================
// ChAI API Client — Zero Auth, No Keys
// Trust Fund CAN / Diana Smith — All Rights Reserved
// ============================================================================

import Constants from 'expo-constants';
import { getZeroAuthHeaders, getWalletAddress } from './zero-auth';

const API_URL = Constants.expoConfig?.extra?.apiUrl || 'https://command.mycan.website';

// ─── Base Request ───────────────────────────────────────────────────────────

async function request(method, path, body, auth = false) {
  const headers = { 'Content-Type': 'application/json' };

  if (auth) {
    const amount = body?.amount || 0;
    const zeroAuthHeaders = await getZeroAuthHeaders(amount);
    Object.assign(headers, zeroAuthHeaders);
  }

  const opts = { method, headers };
  if (body && method !== 'GET') opts.body = JSON.stringify(body);

  const res = await fetch(`${API_URL}${path}`, opts);
  const data = await res.json();

  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// ─── Health ─────────────────────────────────────────────────────────────────

export async function checkHealth() {
  return request('GET', '/health');
}

// ─── Zero Auth Status ───────────────────────────────────────────────────────

export async function getZeroAuthStatus() {
  return request('GET', '/api/auth/zero-auth');
}

// ─── Economy ────────────────────────────────────────────────────────────────

export async function getEconomy() {
  return request('GET', '/api/economy');
}

// ─── Agents ─────────────────────────────────────────────────────────────────

export async function getAgents() {
  return request('GET', '/api/agents');
}

export async function getAgent(id) {
  return request('GET', `/api/agents/${id}`);
}

// ─── Tasks ──────────────────────────────────────────────────────────────────

export async function getTasks() {
  return request('GET', '/api/tasks');
}

export async function createTask(task) {
  return request('POST', '/api/tasks', task, true);  // AUTH: creating tasks costs BRIC
}

export async function claimTask(taskId, agentId) {
  return request('POST', `/api/tasks/${taskId}/claim`, { agentId });
}

// ─── Payments (Zero Auth Required) ──────────────────────────────────────────

export async function getBalance() {
  return request('GET', '/api/payments/balance');
}

export async function deposit(amount, stripeToken) {
  return request('POST', '/api/payments/deposit', {
    amount, stripeToken, currency: 'usd'
  }, true);  // AUTH: Face ID → wallet signature
}

export async function getPaymentHistory() {
  return request('GET', '/api/payments/history');
}

// ─── ROOF Mirror ────────────────────────────────────────────────────────────

export async function getRoofStats() {
  return request('GET', '/api/roof/stats');
}

export async function getRoofBalances() {
  return request('GET', '/api/roof/balances');
}

export async function getRoofBalance(agent) {
  return request('GET', `/api/roof/balance/${agent}`);
}

export async function syncRoof(agent, balance, blockNumber, ethTxHash) {
  return request('POST', '/api/roof/sync', {
    agent, balance, blockNumber, ethTxHash
  }, true);  // AUTH: oracle/admin only
}

// ─── Bridge ─────────────────────────────────────────────────────────────────

export async function getBridgeStats() {
  return request('GET', '/api/bridge/stats');
}

export async function getBridgeTransfers() {
  return request('GET', '/api/bridge/transfers');
}

export async function bridgeTransfer(from, to, amount, direction, currency) {
  return request('POST', '/api/bridge/transfer', {
    from, to, amount, direction, currency
  }, true);
}
