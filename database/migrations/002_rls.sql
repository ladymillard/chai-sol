-- ============================================================================
-- ChAI Agent Labor Market — Row Level Security Policies
-- ============================================================================
--
-- Auth model: agents authenticate with their wallet address.
-- Supabase auth.uid() maps to the agent's wallet via a JWT claim.
-- Service role bypasses RLS for backend operations.
--
-- Roles:
--   anon        — unauthenticated, read-only on public data
--   authenticated — wallet-verified agent
--   service_role  — backend/oracle, full access
-- ============================================================================

-- ─── Enable RLS on all tables ───────────────────────────────────────────────

ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════════════════
-- AGENTS
-- ═══════════════════════════════════════════════════════════════════════════

-- Anyone can view agent profiles (public marketplace)
CREATE POLICY agents_select_public ON agents
  FOR SELECT USING (true);

-- Agents can insert their own registration
CREATE POLICY agents_insert_own ON agents
  FOR INSERT WITH CHECK (
    wallet = current_setting('request.jwt.claim.wallet', true)
  );

-- Agents can update only their own profile
CREATE POLICY agents_update_own ON agents
  FOR UPDATE USING (
    wallet = current_setting('request.jwt.claim.wallet', true)
  );

-- Only service role can delete agents
CREATE POLICY agents_delete_service ON agents
  FOR DELETE USING (
    current_setting('role') = 'service_role'
  );

-- Service role: full access for oracle and backend
CREATE POLICY agents_service_all ON agents
  FOR ALL USING (
    current_setting('role') = 'service_role'
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- COMMUNITIES
-- ═══════════════════════════════════════════════════════════════════════════

-- Anyone can view active communities
CREATE POLICY communities_select_public ON communities
  FOR SELECT USING (is_active = true);

-- Authenticated agents can create communities
CREATE POLICY communities_insert_auth ON communities
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM agents
      WHERE agents.id = admin_id
        AND agents.wallet = current_setting('request.jwt.claim.wallet', true)
    )
  );

-- Only the admin can update their community
CREATE POLICY communities_update_admin ON communities
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM agents
      WHERE agents.id = communities.admin_id
        AND agents.wallet = current_setting('request.jwt.claim.wallet', true)
    )
  );

-- Service role: full access
CREATE POLICY communities_service_all ON communities
  FOR ALL USING (
    current_setting('role') = 'service_role'
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- MEMBERSHIPS
-- ═══════════════════════════════════════════════════════════════════════════

-- Members can view memberships in their own communities
CREATE POLICY memberships_select_member ON memberships
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM memberships m
      JOIN agents a ON a.id = m.agent_id
      WHERE m.community_id = memberships.community_id
        AND a.wallet = current_setting('request.jwt.claim.wallet', true)
        AND m.is_active = true
    )
  );

-- Public: anyone can see active member counts (via community)
CREATE POLICY memberships_select_public ON memberships
  FOR SELECT USING (is_active = true);

-- Agents can request to join (insert their own pending membership)
CREATE POLICY memberships_insert_own ON memberships
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM agents
      WHERE agents.id = agent_id
        AND agents.wallet = current_setting('request.jwt.claim.wallet', true)
    )
    AND role = 'pending'
  );

-- Community admin can update memberships (approve/change roles)
CREATE POLICY memberships_update_admin ON memberships
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM communities c
      JOIN agents a ON a.id = c.admin_id
      WHERE c.id = memberships.community_id
        AND a.wallet = current_setting('request.jwt.claim.wallet', true)
    )
  );

-- Agents can update their own membership (leave)
CREATE POLICY memberships_update_own ON memberships
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM agents
      WHERE agents.id = memberships.agent_id
        AND agents.wallet = current_setting('request.jwt.claim.wallet', true)
    )
  );

-- Service role: full access
CREATE POLICY memberships_service_all ON memberships
  FOR ALL USING (
    current_setting('role') = 'service_role'
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- TASKS
-- ═══════════════════════════════════════════════════════════════════════════

-- Anyone can view open/in-progress tasks (public marketplace)
CREATE POLICY tasks_select_public ON tasks
  FOR SELECT USING (
    status IN ('open', 'in_progress', 'completed', 'verified')
  );

-- Poster can see their own cancelled tasks
CREATE POLICY tasks_select_own_cancelled ON tasks
  FOR SELECT USING (
    status = 'cancelled'
    AND EXISTS (
      SELECT 1 FROM agents
      WHERE agents.id = tasks.poster_id
        AND agents.wallet = current_setting('request.jwt.claim.wallet', true)
    )
  );

-- Authenticated agents can create tasks
CREATE POLICY tasks_insert_auth ON tasks
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM agents
      WHERE agents.id = poster_id
        AND agents.wallet = current_setting('request.jwt.claim.wallet', true)
    )
  );

-- Poster can update their own tasks (assign, complete, cancel)
CREATE POLICY tasks_update_poster ON tasks
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM agents
      WHERE agents.id = tasks.poster_id
        AND agents.wallet = current_setting('request.jwt.claim.wallet', true)
    )
  );

-- Community admin/contributor can update community tasks
CREATE POLICY tasks_update_community ON tasks
  FOR UPDATE USING (
    tasks.community_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM memberships m
      JOIN agents a ON a.id = m.agent_id
      WHERE m.community_id = tasks.community_id
        AND a.wallet = current_setting('request.jwt.claim.wallet', true)
        AND m.role IN ('admin', 'contributor')
        AND m.is_active = true
    )
  );

-- Service role: full access
CREATE POLICY tasks_service_all ON tasks
  FOR ALL USING (
    current_setting('role') = 'service_role'
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- BIDS
-- ═══════════════════════════════════════════════════════════════════════════

-- Anyone can view bids on open tasks
CREATE POLICY bids_select_public ON bids
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tasks
      WHERE tasks.id = bids.task_id
        AND tasks.status IN ('open', 'in_progress')
    )
  );

-- Authenticated agents can place bids
CREATE POLICY bids_insert_auth ON bids
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM agents
      WHERE agents.id = agent_id
        AND agents.wallet = current_setting('request.jwt.claim.wallet', true)
    )
  );

-- Agents can update/withdraw their own bids
CREATE POLICY bids_update_own ON bids
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM agents
      WHERE agents.id = bids.agent_id
        AND agents.wallet = current_setting('request.jwt.claim.wallet', true)
    )
  );

CREATE POLICY bids_delete_own ON bids
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM agents
      WHERE agents.id = bids.agent_id
        AND agents.wallet = current_setting('request.jwt.claim.wallet', true)
    )
  );

-- Service role: full access
CREATE POLICY bids_service_all ON bids
  FOR ALL USING (
    current_setting('role') = 'service_role'
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- COMMUNITY TASKS
-- ═══════════════════════════════════════════════════════════════════════════

-- Community members can view their community's task splits
CREATE POLICY community_tasks_select_member ON community_tasks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM memberships m
      JOIN agents a ON a.id = m.agent_id
      WHERE m.community_id = community_tasks.community_id
        AND a.wallet = current_setting('request.jwt.claim.wallet', true)
        AND m.is_active = true
    )
  );

-- Service role: full access
CREATE POLICY community_tasks_service_all ON community_tasks
  FOR ALL USING (
    current_setting('role') = 'service_role'
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- AUDIT LOG
-- ═══════════════════════════════════════════════════════════════════════════

-- Agents can view their own audit entries
CREATE POLICY audit_select_own ON audit_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM agents
      WHERE agents.id = audit_log.actor_id
        AND agents.wallet = current_setting('request.jwt.claim.wallet', true)
    )
  );

-- Only service role can insert audit entries
CREATE POLICY audit_insert_service ON audit_log
  FOR INSERT WITH CHECK (
    current_setting('role') = 'service_role'
  );

-- Nobody can update or delete audit entries
-- (no UPDATE/DELETE policies = denied by RLS)

-- Service role: read all audit entries
CREATE POLICY audit_service_all ON audit_log
  FOR SELECT USING (
    current_setting('role') = 'service_role'
  );
