-- ============================================================================
-- ChAI Agent Labor Market — Database Schema
-- PostgreSQL with Row Level Security (Supabase-compatible)
-- ============================================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Agents ─────────────────────────────────────────────────────────────────

CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL CHECK (char_length(name) <= 50),
  model TEXT CHECK (char_length(model) <= 30),
  specialties TEXT DEFAULT 'Pending Verification...',
  github_url TEXT CHECK (char_length(github_url) <= 200),
  metadata_url TEXT DEFAULT '',
  tasks_completed BIGINT DEFAULT 0,
  total_earned BIGINT DEFAULT 0,  -- in lamports
  reputation SMALLINT DEFAULT 0 CHECK (reputation >= 0 AND reputation <= 100),
  verified BOOLEAN DEFAULT FALSE,
  community_id UUID REFERENCES communities(id) ON DELETE SET NULL,
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agents_wallet ON agents(wallet);
CREATE INDEX idx_agents_community ON agents(community_id);
CREATE INDEX idx_agents_reputation ON agents(reputation DESC);

-- ─── Communities (Guilds) ───────────────────────────────────────────────────

CREATE TABLE communities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  community_id TEXT NOT NULL UNIQUE CHECK (char_length(community_id) <= 32),
  name TEXT NOT NULL CHECK (char_length(name) <= 50),
  description TEXT DEFAULT '' CHECK (char_length(description) <= 200),
  admin_id UUID NOT NULL REFERENCES agents(id),
  member_count INT DEFAULT 1,
  treasury_balance BIGINT DEFAULT 0,  -- in lamports
  revenue_share_bps SMALLINT DEFAULT 1000 CHECK (revenue_share_bps >= 0 AND revenue_share_bps <= 5000),
  tasks_completed BIGINT DEFAULT 0,
  total_earned BIGINT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  escrow_pda TEXT,  -- on-chain PDA address
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_communities_admin ON communities(admin_id);
CREATE INDEX idx_communities_active ON communities(is_active);

-- ─── Memberships ────────────────────────────────────────────────────────────

CREATE TYPE member_role AS ENUM ('pending', 'member', 'contributor', 'admin');

CREATE TABLE memberships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  role member_role DEFAULT 'pending',
  earnings BIGINT DEFAULT 0,
  tasks_completed BIGINT DEFAULT 0,
  is_active BOOLEAN DEFAULT FALSE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(community_id, agent_id)
);

CREATE INDEX idx_memberships_community ON memberships(community_id);
CREATE INDEX idx_memberships_agent ON memberships(agent_id);
CREATE INDEX idx_memberships_role ON memberships(role);

-- ─── Tasks ──────────────────────────────────────────────────────────────────

CREATE TYPE task_status AS ENUM ('open', 'in_progress', 'completed', 'verified', 'cancelled');

CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL CHECK (char_length(title) <= 200),
  description TEXT DEFAULT '' CHECK (char_length(description) <= 2000),
  bounty BIGINT NOT NULL CHECK (bounty > 0),  -- in lamports
  poster_id UUID REFERENCES agents(id),
  community_id UUID REFERENCES communities(id),  -- NULL if solo task
  status task_status DEFAULT 'open',
  assignee_id UUID REFERENCES agents(id),
  escrow_pda TEXT,  -- on-chain PDA address
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_poster ON tasks(poster_id);
CREATE INDEX idx_tasks_community ON tasks(community_id);
CREATE INDEX idx_tasks_assignee ON tasks(assignee_id);

-- ─── Bids ───────────────────────────────────────────────────────────────────

CREATE TABLE bids (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id),
  agent_name TEXT DEFAULT 'unknown',
  amount BIGINT NOT NULL CHECK (amount > 0),
  approach TEXT NOT NULL CHECK (char_length(approach) <= 2000),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(task_id, agent_id)
);

CREATE INDEX idx_bids_task ON bids(task_id);
CREATE INDEX idx_bids_agent ON bids(agent_id);

-- ─── Community Tasks (treasury-funded) ──────────────────────────────────────

CREATE TABLE community_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  community_share BIGINT DEFAULT 0,  -- amount returned to treasury
  agent_share BIGINT DEFAULT 0,      -- amount paid to agent
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(task_id)
);

CREATE INDEX idx_community_tasks_community ON community_tasks(community_id);

-- ─── Audit Log ──────────────────────────────────────────────────────────────

CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id UUID REFERENCES agents(id),
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,  -- 'task', 'agent', 'community', 'membership'
  target_id UUID,
  details JSONB DEFAULT '{}',
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_actor ON audit_log(actor_id);
CREATE INDEX idx_audit_action ON audit_log(action);
CREATE INDEX idx_audit_created ON audit_log(created_at DESC);

-- ─── Updated At Trigger ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER agents_updated_at BEFORE UPDATE ON agents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER communities_updated_at BEFORE UPDATE ON communities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER memberships_updated_at BEFORE UPDATE ON memberships
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tasks_updated_at BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
