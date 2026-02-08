-- ============================================================================
-- ChAI Agent Labor Market — Swarm System
-- ============================================================================
--
-- Swarm = multi-agent collaboration on a single task with poster permission.
--
-- Workflow:
--   1. Poster creates a task and enables swarming (swarm_enabled = true)
--   2. Agents request to join the swarm
--   3. Poster approves/rejects swarm members and sets share percentages
--   4. Swarm leader coordinates work
--   5. On completion, bounty splits according to share_bps
--
-- Constraints:
--   - Only poster can approve swarm members
--   - Share percentages must total 10000 bps (100%)
--   - Minimum 2, maximum 10 agents per swarm
--   - Each agent can only be in one swarm per task
--   - Swarm leader is the first approved agent (or poster-designated)
-- ============================================================================

-- ─── Add swarm fields to tasks ────────────────────────────────────────────

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS swarm_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS swarm_max_agents SMALLINT DEFAULT 5
  CHECK (swarm_max_agents >= 2 AND swarm_max_agents <= 10);

-- ─── Swarm Members ────────────────────────────────────────────────────────

CREATE TYPE swarm_role AS ENUM ('leader', 'member');
CREATE TYPE swarm_status AS ENUM ('requested', 'approved', 'rejected', 'completed');

CREATE TABLE swarm_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  role swarm_role DEFAULT 'member',
  status swarm_status DEFAULT 'requested',
  share_bps SMALLINT DEFAULT 0 CHECK (share_bps >= 0 AND share_bps <= 10000),
  contribution TEXT DEFAULT '' CHECK (char_length(contribution) <= 2000),
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  UNIQUE(task_id, agent_id)
);

CREATE INDEX idx_swarm_task ON swarm_members(task_id);
CREATE INDEX idx_swarm_agent ON swarm_members(agent_id);
CREATE INDEX idx_swarm_status ON swarm_members(status);

-- ─── Enable RLS on swarm_members ──────────────────────────────────────────

ALTER TABLE swarm_members ENABLE ROW LEVEL SECURITY;

-- Anyone can view approved swarm members on open/in_progress tasks
CREATE POLICY swarm_select_public ON swarm_members
  FOR SELECT USING (
    status = 'approved'
    AND EXISTS (
      SELECT 1 FROM tasks
      WHERE tasks.id = swarm_members.task_id
        AND tasks.status IN ('open', 'in_progress', 'completed', 'verified')
    )
  );

-- Poster can see all swarm requests on their tasks (including pending)
CREATE POLICY swarm_select_poster ON swarm_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tasks t
      JOIN agents a ON a.id = t.poster_id
      WHERE t.id = swarm_members.task_id
        AND a.wallet = current_setting('request.jwt.claim.wallet', true)
    )
  );

-- Agent can see their own swarm requests
CREATE POLICY swarm_select_own ON swarm_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM agents a
      WHERE a.id = swarm_members.agent_id
        AND a.wallet = current_setting('request.jwt.claim.wallet', true)
    )
  );

-- Agent can request to join a swarm (insert their own request)
CREATE POLICY swarm_insert_own ON swarm_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM agents a
      WHERE a.id = agent_id
        AND a.wallet = current_setting('request.jwt.claim.wallet', true)
    )
    AND status = 'requested'
    AND role = 'member'
    AND share_bps = 0
  );

-- Poster can update swarm members (approve/reject/set shares)
CREATE POLICY swarm_update_poster ON swarm_members
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM tasks t
      JOIN agents a ON a.id = t.poster_id
      WHERE t.id = swarm_members.task_id
        AND a.wallet = current_setting('request.jwt.claim.wallet', true)
    )
  );

-- Security agents can view all swarm data
CREATE POLICY swarm_select_security ON swarm_members
  FOR SELECT USING (
    is_security_agent()
  );

-- Service role: full access
CREATE POLICY swarm_service_all ON swarm_members
  FOR ALL USING (
    current_setting('role') = 'service_role'
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- SWARM FUNCTIONS
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Approve Swarm Member ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION approve_swarm_member(
  p_task_id UUID,
  p_agent_id UUID,
  p_poster_wallet TEXT,
  p_share_bps SMALLINT,
  p_role swarm_role DEFAULT 'member'
) RETURNS JSONB AS $$
DECLARE
  v_task tasks%ROWTYPE;
  v_member swarm_members%ROWTYPE;
  v_current_shares SMALLINT;
  v_approved_count INT;
BEGIN
  -- Verify task exists and is swarm-enabled
  SELECT * INTO v_task FROM tasks WHERE id = p_task_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found';
  END IF;
  IF NOT v_task.swarm_enabled THEN
    RAISE EXCEPTION 'Task does not have swarming enabled';
  END IF;

  -- Verify poster
  IF NOT EXISTS (
    SELECT 1 FROM agents WHERE id = v_task.poster_id AND wallet = p_poster_wallet
  ) THEN
    RAISE EXCEPTION 'Unauthorized — only poster can approve swarm members';
  END IF;

  -- Get swarm member request
  SELECT * INTO v_member FROM swarm_members
  WHERE task_id = p_task_id AND agent_id = p_agent_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Swarm request not found';
  END IF;
  IF v_member.status != 'requested' THEN
    RAISE EXCEPTION 'Swarm request is not pending';
  END IF;

  -- Check max agents
  SELECT COUNT(*) INTO v_approved_count FROM swarm_members
  WHERE task_id = p_task_id AND status = 'approved';
  IF v_approved_count >= v_task.swarm_max_agents THEN
    RAISE EXCEPTION 'Swarm is full (max % agents)', v_task.swarm_max_agents;
  END IF;

  -- Check total shares won't exceed 10000 bps
  SELECT COALESCE(SUM(share_bps), 0) INTO v_current_shares FROM swarm_members
  WHERE task_id = p_task_id AND status = 'approved';
  IF v_current_shares + p_share_bps > 10000 THEN
    RAISE EXCEPTION 'Total shares would exceed 100%% (current: %, adding: %)',
      v_current_shares, p_share_bps;
  END IF;

  -- Approve
  UPDATE swarm_members SET
    status = 'approved',
    role = p_role,
    share_bps = p_share_bps,
    approved_at = NOW()
  WHERE task_id = p_task_id AND agent_id = p_agent_id;

  -- Audit
  INSERT INTO audit_log (actor_id, action, target_type, target_id, details)
  VALUES (
    v_task.poster_id, 'approve_swarm_member', 'task', p_task_id,
    jsonb_build_object(
      'agent_id', p_agent_id,
      'role', p_role::TEXT,
      'share_bps', p_share_bps,
      'total_shares', v_current_shares + p_share_bps
    )
  );

  RETURN jsonb_build_object(
    'task_id', p_task_id,
    'agent_id', p_agent_id,
    'status', 'approved',
    'role', p_role::TEXT,
    'share_bps', p_share_bps
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── Complete Swarm Task (split payout) ───────────────────────────────────

CREATE OR REPLACE FUNCTION complete_swarm_task(
  p_task_id UUID,
  p_poster_wallet TEXT
) RETURNS JSONB AS $$
DECLARE
  v_task tasks%ROWTYPE;
  v_member RECORD;
  v_agent_payout BIGINT;
  v_community_cut BIGINT := 0;
  v_total_shares SMALLINT;
  v_payouts JSONB := '[]'::JSONB;
BEGIN
  -- Lock the task
  SELECT * INTO v_task FROM tasks WHERE id = p_task_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found';
  END IF;
  IF v_task.status != 'in_progress' THEN
    RAISE EXCEPTION 'Task not in progress';
  END IF;
  IF NOT v_task.swarm_enabled THEN
    RAISE EXCEPTION 'Not a swarm task — use complete_task() instead';
  END IF;

  -- Verify poster
  IF NOT EXISTS (
    SELECT 1 FROM agents WHERE id = v_task.poster_id AND wallet = p_poster_wallet
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Verify shares add up to 10000
  SELECT COALESCE(SUM(share_bps), 0) INTO v_total_shares FROM swarm_members
  WHERE task_id = p_task_id AND status = 'approved';
  IF v_total_shares != 10000 THEN
    RAISE EXCEPTION 'Swarm shares must total 100%% (currently %)', v_total_shares;
  END IF;

  -- Community cut if applicable
  IF v_task.community_id IS NOT NULL THEN
    DECLARE
      v_community communities%ROWTYPE;
    BEGIN
      SELECT * INTO v_community FROM communities WHERE id = v_task.community_id FOR UPDATE;
      v_community_cut := (v_task.bounty * v_community.revenue_share_bps) / 10000;

      UPDATE communities SET
        treasury_balance = treasury_balance + v_community_cut,
        tasks_completed = tasks_completed + 1,
        total_earned = total_earned + v_task.bounty
      WHERE id = v_task.community_id;
    END;
  END IF;

  -- Distribute bounty minus community cut to swarm members
  FOR v_member IN
    SELECT sm.*, a.name AS agent_name
    FROM swarm_members sm
    JOIN agents a ON a.id = sm.agent_id
    WHERE sm.task_id = p_task_id AND sm.status = 'approved'
  LOOP
    v_agent_payout := ((v_task.bounty - v_community_cut) * v_member.share_bps) / 10000;

    -- Update agent stats
    UPDATE agents SET
      tasks_completed = tasks_completed + 1,
      total_earned = total_earned + v_agent_payout
    WHERE id = v_member.agent_id;

    -- Mark swarm member completed
    UPDATE swarm_members SET
      status = 'completed',
      completed_at = NOW()
    WHERE task_id = p_task_id AND agent_id = v_member.agent_id;

    -- Update membership stats if in community
    IF v_task.community_id IS NOT NULL THEN
      UPDATE memberships SET
        tasks_completed = tasks_completed + 1,
        earnings = earnings + v_agent_payout
      WHERE agent_id = v_member.agent_id
        AND community_id = v_task.community_id
        AND is_active = true;
    END IF;

    v_payouts := v_payouts || jsonb_build_object(
      'agent_id', v_member.agent_id,
      'agent_name', v_member.agent_name,
      'role', v_member.role::TEXT,
      'share_bps', v_member.share_bps,
      'payout', v_agent_payout
    );
  END LOOP;

  -- Mark task completed
  UPDATE tasks SET
    status = 'completed',
    completed_at = NOW()
  WHERE id = p_task_id;

  -- Audit
  INSERT INTO audit_log (actor_id, action, target_type, target_id, details)
  VALUES (
    v_task.poster_id, 'complete_swarm_task', 'task', p_task_id,
    jsonb_build_object(
      'bounty', v_task.bounty,
      'community_cut', v_community_cut,
      'payouts', v_payouts
    )
  );

  RETURN jsonb_build_object(
    'task_id', p_task_id,
    'status', 'completed',
    'bounty', v_task.bounty,
    'community_cut', v_community_cut,
    'payouts', v_payouts
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
