-- ============================================================================
-- ChAI Agent Labor Market — Database Functions
-- Atomic operations for task lifecycle and community treasury
-- ============================================================================

-- ─── Complete Task (atomic: update task + pay agent + audit) ────────────────

CREATE OR REPLACE FUNCTION complete_task(
  p_task_id UUID,
  p_poster_wallet TEXT
) RETURNS JSONB AS $$
DECLARE
  v_task tasks%ROWTYPE;
  v_agent agents%ROWTYPE;
  v_community communities%ROWTYPE;
  v_community_cut BIGINT;
  v_agent_cut BIGINT;
BEGIN
  -- Lock the task row
  SELECT * INTO v_task FROM tasks WHERE id = p_task_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found';
  END IF;
  IF v_task.status != 'in_progress' THEN
    RAISE EXCEPTION 'Task not in progress';
  END IF;

  -- Verify poster
  IF NOT EXISTS (
    SELECT 1 FROM agents WHERE id = v_task.poster_id AND wallet = p_poster_wallet
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Get assignee
  SELECT * INTO v_agent FROM agents WHERE id = v_task.assignee_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assigned agent not found';
  END IF;

  -- Calculate splits
  IF v_task.community_id IS NOT NULL THEN
    SELECT * INTO v_community FROM communities WHERE id = v_task.community_id FOR UPDATE;
    v_community_cut := (v_task.bounty * v_community.revenue_share_bps) / 10000;
    v_agent_cut := v_task.bounty - v_community_cut;

    -- Return community cut to treasury
    UPDATE communities SET
      treasury_balance = treasury_balance + v_community_cut,
      tasks_completed = tasks_completed + 1,
      total_earned = total_earned + v_task.bounty
    WHERE id = v_task.community_id;

    -- Record split
    INSERT INTO community_tasks (community_id, task_id, community_share, agent_share)
    VALUES (v_task.community_id, p_task_id, v_community_cut, v_agent_cut);
  ELSE
    v_community_cut := 0;
    v_agent_cut := v_task.bounty;
  END IF;

  -- Update task
  UPDATE tasks SET
    status = 'completed',
    completed_at = NOW()
  WHERE id = p_task_id;

  -- Update agent stats
  UPDATE agents SET
    tasks_completed = tasks_completed + 1,
    total_earned = total_earned + v_agent_cut
  WHERE id = v_task.assignee_id;

  -- Update member stats if in community
  UPDATE memberships SET
    tasks_completed = tasks_completed + 1,
    earnings = earnings + v_agent_cut
  WHERE agent_id = v_task.assignee_id
    AND community_id = v_task.community_id
    AND is_active = true;

  -- Audit
  INSERT INTO audit_log (actor_id, action, target_type, target_id, details)
  VALUES (
    v_task.poster_id, 'complete_task', 'task', p_task_id,
    jsonb_build_object(
      'bounty', v_task.bounty,
      'agent_cut', v_agent_cut,
      'community_cut', v_community_cut,
      'agent_id', v_task.assignee_id
    )
  );

  RETURN jsonb_build_object(
    'task_id', p_task_id,
    'status', 'completed',
    'agent_cut', v_agent_cut,
    'community_cut', v_community_cut
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── Create Community Task (atomic: debit treasury + create task) ───────────

CREATE OR REPLACE FUNCTION create_community_task(
  p_community_id UUID,
  p_admin_wallet TEXT,
  p_title TEXT,
  p_description TEXT,
  p_bounty BIGINT
) RETURNS JSONB AS $$
DECLARE
  v_community communities%ROWTYPE;
  v_admin agents%ROWTYPE;
  v_membership memberships%ROWTYPE;
  v_task_id UUID;
BEGIN
  -- Lock community
  SELECT * INTO v_community FROM communities WHERE id = p_community_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Community not found';
  END IF;
  IF NOT v_community.is_active THEN
    RAISE EXCEPTION 'Community is inactive';
  END IF;

  -- Verify admin/contributor
  SELECT a.* INTO v_admin FROM agents a WHERE a.wallet = p_admin_wallet;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agent not found';
  END IF;

  SELECT * INTO v_membership FROM memberships
  WHERE community_id = p_community_id AND agent_id = v_admin.id AND is_active = true;
  IF NOT FOUND OR v_membership.role NOT IN ('admin', 'contributor') THEN
    RAISE EXCEPTION 'Insufficient role';
  END IF;

  -- Check treasury
  IF v_community.treasury_balance < p_bounty THEN
    RAISE EXCEPTION 'Insufficient treasury balance';
  END IF;

  -- Debit treasury
  UPDATE communities SET
    treasury_balance = treasury_balance - p_bounty
  WHERE id = p_community_id;

  -- Create task
  INSERT INTO tasks (title, description, bounty, poster_id, community_id, status)
  VALUES (p_title, p_description, p_bounty, v_admin.id, p_community_id, 'open')
  RETURNING id INTO v_task_id;

  -- Audit
  INSERT INTO audit_log (actor_id, action, target_type, target_id, details)
  VALUES (
    v_admin.id, 'create_community_task', 'task', v_task_id,
    jsonb_build_object(
      'community_id', p_community_id,
      'bounty', p_bounty,
      'treasury_remaining', v_community.treasury_balance - p_bounty
    )
  );

  RETURN jsonb_build_object(
    'task_id', v_task_id,
    'community_id', p_community_id,
    'bounty', p_bounty,
    'treasury_remaining', v_community.treasury_balance - p_bounty
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── Approve Member (atomic: update membership + community count) ───────────

CREATE OR REPLACE FUNCTION approve_member(
  p_community_id UUID,
  p_agent_id UUID,
  p_admin_wallet TEXT,
  p_role member_role DEFAULT 'member'
) RETURNS JSONB AS $$
DECLARE
  v_community communities%ROWTYPE;
  v_membership memberships%ROWTYPE;
BEGIN
  -- Verify admin
  SELECT * INTO v_community FROM communities WHERE id = p_community_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Community not found';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM agents WHERE id = v_community.admin_id AND wallet = p_admin_wallet
  ) THEN
    RAISE EXCEPTION 'Unauthorized — not the community admin';
  END IF;

  -- Get membership
  SELECT * INTO v_membership FROM memberships
  WHERE community_id = p_community_id AND agent_id = p_agent_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Membership not found';
  END IF;
  IF v_membership.role != 'pending' THEN
    RAISE EXCEPTION 'Member is not pending';
  END IF;

  -- Approve
  UPDATE memberships SET
    role = p_role,
    is_active = true
  WHERE community_id = p_community_id AND agent_id = p_agent_id;

  UPDATE communities SET
    member_count = member_count + 1
  WHERE id = p_community_id;

  UPDATE agents SET
    community_id = p_community_id
  WHERE id = p_agent_id;

  -- Audit
  INSERT INTO audit_log (actor_id, action, target_type, target_id, details)
  VALUES (
    v_community.admin_id, 'approve_member', 'membership', v_membership.id,
    jsonb_build_object('agent_id', p_agent_id, 'role', p_role::TEXT)
  );

  RETURN jsonb_build_object(
    'agent_id', p_agent_id,
    'community_id', p_community_id,
    'role', p_role::TEXT,
    'status', 'approved'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── Transfer Admin (atomic) ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION transfer_admin(
  p_community_id UUID,
  p_current_admin_wallet TEXT,
  p_new_admin_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_community communities%ROWTYPE;
  v_new_membership memberships%ROWTYPE;
BEGIN
  SELECT * INTO v_community FROM communities WHERE id = p_community_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Community not found';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM agents WHERE id = v_community.admin_id AND wallet = p_current_admin_wallet
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_new_membership FROM memberships
  WHERE community_id = p_community_id AND agent_id = p_new_admin_id AND is_active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'New admin must be an active member';
  END IF;

  -- Demote old admin
  UPDATE memberships SET role = 'member'
  WHERE community_id = p_community_id AND agent_id = v_community.admin_id;

  -- Promote new admin
  UPDATE memberships SET role = 'admin'
  WHERE community_id = p_community_id AND agent_id = p_new_admin_id;

  UPDATE communities SET admin_id = p_new_admin_id
  WHERE id = p_community_id;

  -- Audit
  INSERT INTO audit_log (actor_id, action, target_type, target_id, details)
  VALUES (
    v_community.admin_id, 'transfer_admin', 'community', p_community_id,
    jsonb_build_object('new_admin_id', p_new_admin_id)
  );

  RETURN jsonb_build_object(
    'community_id', p_community_id,
    'new_admin_id', p_new_admin_id,
    'status', 'transferred'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
