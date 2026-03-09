-- Gamification: XP events ledger
--
-- XP is currently derived from activity counts in the application layer.
-- This table acts as an immutable event log that enables:
--   • Audit trail: every XP award is traceable to a source action
--   • Future trigger-based automation (award XP on insert to other tables)
--   • Bonus/manual XP grants from admin or promotions
--   • Accurate historical replays without re-querying every table

CREATE TABLE user_xp_events (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- event_type classifies the earning action; open-ended text for extensibility
  event_type   TEXT         NOT NULL,
  xp_awarded   INTEGER      NOT NULL CHECK (xp_awarded > 0),
  -- reference_id optionally links back to the row that triggered this event
  reference_id UUID,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Fast per-user chronological queries
CREATE INDEX user_xp_events_user_id_created_at_idx
  ON user_xp_events (user_id, created_at DESC);

-- Fast aggregate totals (used by the gamification hook)
CREATE INDEX user_xp_events_user_id_xp_idx
  ON user_xp_events (user_id, xp_awarded);

ALTER TABLE user_xp_events ENABLE ROW LEVEL SECURITY;

-- RLS: users can only see and record their own XP events
CREATE POLICY "Users can view own xp events"
  ON user_xp_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own xp events"
  ON user_xp_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);
