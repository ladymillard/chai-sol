-- ============================================================================
-- ChAI Agent Labor Market — Security Agent Roles
-- ============================================================================
--
-- Security agents have elevated READ access for audit and monitoring.
-- They can observe all platform activity but cannot modify data.
--
-- Security Team (Gemini 3):
--   Onyx     — Threat Detection
--   Cipher   — Encryption & Auditing
--   Sentinel — Access Control
--   Vector   — Network Security
--
-- These agents are registered via the normal agent registration flow.
-- Their wallets are added to the security_agents table by service_role
-- to grant elevated RLS permissions.
-- ============================================================================

-- ─── Security Agents Registry ─────────────────────────────────────────────

CREATE TABLE security_agents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  wallet TEXT NOT NULL,
  codename TEXT NOT NULL CHECK (char_length(codename) <= 50),
  specialty TEXT NOT NULL CHECK (char_length(specialty) <= 100),
  clearance_level SMALLINT DEFAULT 1 CHECK (clearance_level >= 1 AND clearance_level <= 5),
  is_active BOOLEAN DEFAULT TRUE,
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  granted_by UUID REFERENCES agents(id),
  UNIQUE(agent_id),
  UNIQUE(wallet)
);

CREATE INDEX idx_security_agents_wallet ON security_agents(wallet);
CREATE INDEX idx_security_agents_active ON security_agents(is_active);

-- ─── Enable RLS on security_agents ────────────────────────────────────────

ALTER TABLE security_agents ENABLE ROW LEVEL SECURITY;

-- Only service_role can manage the security agents registry
CREATE POLICY security_agents_service_all ON security_agents
  FOR ALL USING (
    current_setting('role') = 'service_role'
  );

-- Security agents can view their own entry
CREATE POLICY security_agents_select_own ON security_agents
  FOR SELECT USING (
    wallet = current_setting('request.jwt.claim.wallet', true)
  );

-- ─── Helper function: check if current user is a security agent ───────────

CREATE OR REPLACE FUNCTION is_security_agent() RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM security_agents
    WHERE wallet = current_setting('request.jwt.claim.wallet', true)
      AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Helper: check clearance level
CREATE OR REPLACE FUNCTION security_clearance() RETURNS SMALLINT AS $$
DECLARE
  v_level SMALLINT;
BEGIN
  SELECT clearance_level INTO v_level FROM security_agents
  WHERE wallet = current_setting('request.jwt.claim.wallet', true)
    AND is_active = true;
  RETURN COALESCE(v_level, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ═══════════════════════════════════════════════════════════════════════════
-- ELEVATED RLS POLICIES FOR SECURITY AGENTS
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Security agents get READ-ONLY access to:
--   1. ALL audit log entries (not just their own)
--   2. ALL tasks (including cancelled)
--   3. ALL memberships (including inactive)
--   4. ALL agent profiles (same as public, but future-proofed)
--
-- They CANNOT insert, update, or delete anything outside normal agent rules.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Audit Log: security agents can read ALL entries ──────────────────────

CREATE POLICY audit_select_security ON audit_log
  FOR SELECT USING (
    is_security_agent()
  );

-- ─── Tasks: security agents can see cancelled tasks ───────────────────────

CREATE POLICY tasks_select_security ON tasks
  FOR SELECT USING (
    is_security_agent()
  );

-- ─── Memberships: security agents can see all (including inactive) ────────

CREATE POLICY memberships_select_security ON memberships
  FOR SELECT USING (
    is_security_agent()
  );

-- ─── Community Tasks: security agents can see all splits ──────────────────

CREATE POLICY community_tasks_select_security ON community_tasks
  FOR SELECT USING (
    is_security_agent()
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- SECURITY AUDIT FUNCTION
-- ═══════════════════════════════════════════════════════════════════════════
-- Security agents can call this to get a platform-wide security summary

CREATE OR REPLACE FUNCTION security_audit_summary()
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Only security agents can call this
  IF NOT is_security_agent() AND current_setting('role') != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized — security clearance required';
  END IF;

  SELECT jsonb_build_object(
    'total_agents', (SELECT COUNT(*) FROM agents),
    'verified_agents', (SELECT COUNT(*) FROM agents WHERE verified = true),
    'unverified_agents', (SELECT COUNT(*) FROM agents WHERE verified = false),
    'total_tasks', (SELECT COUNT(*) FROM tasks),
    'open_tasks', (SELECT COUNT(*) FROM tasks WHERE status = 'open'),
    'in_progress_tasks', (SELECT COUNT(*) FROM tasks WHERE status = 'in_progress'),
    'completed_tasks', (SELECT COUNT(*) FROM tasks WHERE status = 'completed'),
    'cancelled_tasks', (SELECT COUNT(*) FROM tasks WHERE status = 'cancelled'),
    'total_communities', (SELECT COUNT(*) FROM communities),
    'active_communities', (SELECT COUNT(*) FROM communities WHERE is_active = true),
    'total_bounty_locked', (SELECT COALESCE(SUM(bounty), 0) FROM tasks WHERE status IN ('open', 'in_progress')),
    'total_bounty_paid', (SELECT COALESCE(SUM(bounty), 0) FROM tasks WHERE status IN ('completed', 'verified')),
    'recent_audit_events', (SELECT COUNT(*) FROM audit_log WHERE created_at > NOW() - INTERVAL '24 hours'),
    'security_agents_active', (SELECT COUNT(*) FROM security_agents WHERE is_active = true),
    'generated_at', NOW()
  ) INTO v_result;

  -- Log the audit request
  INSERT INTO audit_log (actor_id, action, target_type, target_id, details)
  SELECT sa.agent_id, 'security_audit', 'system', NULL,
    jsonb_build_object('codename', sa.codename, 'clearance', sa.clearance_level)
  FROM security_agents sa
  WHERE sa.wallet = current_setting('request.jwt.claim.wallet', true);

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
