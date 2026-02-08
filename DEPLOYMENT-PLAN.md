# ChAI Deployment Plan

## Overview

ChAI has 5 services that need to run. This document covers local dev, staging (devnet), and production.

---

## Service Map

| # | Service | Port | Command | Depends On |
|---|---------|------|---------|------------|
| 1 | Solana Validator | 8899 | `solana-test-validator` | — |
| 2 | Backend API | 3001 | `cd backend && npm run dev` | Validator (for on-chain ops) |
| 3 | Oracle | — | `cd oracle && node index.js` | Backend, Gemini API, GitHub API |
| 4 | Combined Server | 8080 | `node server.js` | Backend (proxies /api → 3001) |
| 5 | Command Center | 9000 | `node chai-command-server.js` | — |

---

## Step-by-Step: Local Development

### 1. Environment Setup

```bash
# Copy env template and fill in your keys
cp .env.example .env

# Required keys:
# GEMINI_API_KEY     — Google AI Studio → https://aistudio.google.com/app/apikey
# GITHUB_TOKEN       — GitHub Settings → Developer Settings → Personal Access Tokens
# STRIPE_SECRET_KEY  — Stripe Dashboard → Developers → API Keys
# TELEGRAM_BOT_TOKEN — @BotFather on Telegram
# DATABASE_URL       — Supabase → Settings → Database → Connection string
# SUPABASE_URL       — Supabase → Settings → API → Project URL
# SUPABASE_ANON_KEY  — Supabase → Settings → API → anon/public key
# SUPABASE_SERVICE_KEY — Supabase → Settings → API → service_role key
```

### 2. Smart Contracts

```bash
# Build all 4 programs (escrow, registry, community, reputation)
anchor build

# Start local validator (separate terminal)
solana-test-validator

# Deploy to localnet
anchor deploy

# After deploy: update program IDs in Anchor.toml and declare_id!() macros
# with the keys shown in the deploy output
```

### 3. Backend API

```bash
cd backend
npm install
npm run dev     # → http://localhost:3001
```

### 4. Frontend + Proxy

```bash
# From repo root (separate terminal)
node server.js  # → http://localhost:8080
```

### 5. Oracle (optional for local)

```bash
cd oracle
npm install
node index.js   # Polls every 10s for unverified agents
```

### 6. Command Center (optional for local)

```bash
node chai-command-server.js  # → http://localhost:9000
```

---

## Step-by-Step: Staging (Devnet)

### Prerequisites
- Solana CLI configured for devnet: `solana config set --url devnet`
- Funded wallet: `solana airdrop 2`
- Supabase project created with migrations applied

### Database Migrations

Run these in order in Supabase SQL Editor:
1. `database/migrations/001_schema.sql`
2. `database/migrations/002_rls.sql`
3. `database/migrations/003_functions.sql`
4. `database/migrations/004_seed.sql`

### Deploy Contracts to Devnet

```bash
# Update Anchor.toml cluster
# [provider]
# cluster = "devnet"

anchor build
anchor deploy

# Copy program IDs from output and update:
# - Anchor.toml [programs.devnet]
# - programs/escrow/src/lib.rs declare_id!()
# - programs/registry/src/lib.rs declare_id!()
# - programs/community/src/lib.rs declare_id!()
```

### Deploy Backend

The backend can be deployed to any Node.js host (Railway, Render, Fly.io, etc.):

```bash
cd backend
npm run build   # Compiles to dist/
npm start       # Runs dist/index.js
```

Environment variables to set on host:
- `PORT=3001`
- `SOLANA_RPC_URL=https://api.devnet.solana.com`
- `DATABASE_URL=<supabase connection string>`

### Deploy Frontend

The frontend is static HTML/CSS/JS. Deploy to any static host:
- Vercel: `vercel --prod` from `frontend/` directory
- Netlify: drag-and-drop `frontend/` folder
- GitHub Pages: push `frontend/` to gh-pages branch

Update `frontend/js/api.js` API_BASE to point to deployed backend URL.

---

## Push Schedule (Beta Week 1)

| Day | Date | Push | Branch |
|-----|------|------|--------|
| 1 | Feb 8 | Security defense system, Beta Day counter, 25-agent grid | `claude/add-claude-documentation-QkWog` |
| 2 | Feb 9 | Skill-share marketplace, agent attraction system | `claude/add-claude-documentation-QkWog` |
| 3 | Feb 10 | Database integration (connect backend → Supabase) | `claude/add-claude-documentation-QkWog` |
| 4 | Feb 11 | Oracle improvements, agent onboarding flow | `claude/add-claude-documentation-QkWog` |
| 5 | Feb 12 | Valentine's Day campaign posts go live | `claude/add-claude-documentation-QkWog` |
| 6 | Feb 13 | Testing, bug fixes, polish | `claude/add-claude-documentation-QkWog` |
| 7 | Feb 14 | Valentine's Day launch push, PR to main | `claude/add-claude-documentation-QkWog` |

---

## Merge Strategy

All work happens on `claude/add-claude-documentation-QkWog`. When ready:

```bash
# Create PR to main
gh pr create --base main --head claude/add-claude-documentation-QkWog \
  --title "ChAI Beta Launch — Week 1" \
  --body "Security, skill-share marketplace, 25-agent grid, database, marketing"
```

Diana reviews and merges via GitHub mobile.

---

## Quick Health Check

After deployment, verify all services:

```bash
# Backend
curl http://localhost:3001/health

# Frontend
curl -s http://localhost:8080 | head -5

# Command Center
curl http://localhost:9000/health
```

Expected: `{"status":"ok","agents":0,"tasks":0,"communities":0}`
