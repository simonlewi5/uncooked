-- Activity tracking foundation: normalized event ledger + derived sessions + consistency metrics

-- Consent preference column is intentionally nullable at creation time.
-- Product/legal can later choose default opt-in or opt-out in a follow-up migration.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS analytics_tracking_enabled boolean;

COMMENT ON COLUMN public.users.analytics_tracking_enabled IS
  'User consent for analytics tracking. NULL means unset; true enables tracking; false disables tracking.';

CREATE TABLE IF NOT EXISTS public.activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  activity_type text NOT NULL CHECK (activity_type IN ('resume', 'interview', 'research')),
  event_type text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activity_events_user_created_idx
  ON public.activity_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS activity_events_user_activity_created_idx
  ON public.activity_events (user_id, activity_type, created_at DESC);

ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own activity events"
  ON public.activity_events FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own activity events"
  ON public.activity_events;

-- Enforce service-only writes so all inserts go through edge validation.
REVOKE INSERT ON public.activity_events FROM anon, authenticated;
GRANT INSERT ON public.activity_events TO service_role;

DROP VIEW IF EXISTS public.practice_sessions_v2;
DROP MATERIALIZED VIEW IF EXISTS public.practice_sessions_v2;

CREATE MATERIALIZED VIEW public.practice_sessions_v2 AS
WITH meaningful_events AS (
  SELECT
    user_id,
    activity_type,
    event_type,
    metadata,
    created_at,
    (created_at AT TIME ZONE 'UTC')::date AS session_date
  FROM public.activity_events
  WHERE
    (activity_type = 'resume' AND event_type IN (
      'edit_committed',
      'resume_saved',
      'ai_tailor_triggered',
      'version_created'
    ))
    OR
    (activity_type = 'interview' AND event_type IN (
      'session_started',
      'question_answered',
      'session_completed',
      'feedback_received',
      'session_partial'
    ))
    OR
    (activity_type = 'research' AND event_type IN (
      'company_added',
      'note_saved',
      'link_bookmarked',
      'board_write'
    ))
)
SELECT
  user_id,
  activity_type,
  session_date,
  min(created_at) AS started_at,
  max(created_at) AS ended_at,
  count(*)::int AS event_count,
  bool_or(event_type = 'session_completed' OR coalesce((metadata->>'completed')::boolean, false)) AS completed
FROM meaningful_events
GROUP BY user_id, activity_type, session_date
WITH NO DATA;

CREATE UNIQUE INDEX practice_sessions_v2_user_activity_date_idx
  ON public.practice_sessions_v2 (user_id, activity_type, session_date);

CREATE INDEX practice_sessions_v2_user_date_idx
  ON public.practice_sessions_v2 (user_id, session_date DESC);

REFRESH MATERIALIZED VIEW public.practice_sessions_v2;

CREATE OR REPLACE FUNCTION public.refresh_practice_sessions_v2_concurrently()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.practice_sessions_v2;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_practice_sessions_v2_concurrently() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_practice_sessions_v2_concurrently() TO service_role;

CREATE OR REPLACE FUNCTION public.get_consistency_metrics(p_user_id uuid)
RETURNS TABLE (
  activity_type text,
  current_streak_days int,
  longest_streak_days int,
  sessions_last_7d int,
  sessions_last_30d int,
  last_active_date date
)
LANGUAGE sql
STABLE
AS $$
  WITH sessions AS (
    SELECT
      activity_type,
      session_date
    FROM public.practice_sessions_v2
    WHERE user_id = p_user_id
  ),
  grouped AS (
    SELECT
      activity_type,
      session_date,
      session_date - (row_number() OVER (PARTITION BY activity_type ORDER BY session_date))::int AS streak_group
    FROM sessions
  ),
  streaks AS (
    SELECT
      activity_type,
      min(session_date) AS start_date,
      max(session_date) AS end_date,
      count(*)::int AS streak_len
    FROM grouped
    GROUP BY activity_type, streak_group
  ),
  latest AS (
    SELECT
      activity_type,
      max(session_date) AS last_active_date
    FROM sessions
    GROUP BY activity_type
  ),
  counts AS (
    SELECT
      activity_type,
      count(*) FILTER (WHERE session_date >= current_date - 6)::int AS sessions_last_7d,
      count(*) FILTER (WHERE session_date >= current_date - 29)::int AS sessions_last_30d
    FROM sessions
    GROUP BY activity_type
  )
  SELECT
    l.activity_type,
    coalesce((
      SELECT s.streak_len
      FROM streaks s
      WHERE s.activity_type = l.activity_type
        AND s.end_date >= current_date - 1
      ORDER BY s.end_date DESC
      LIMIT 1
    ), 0) AS current_streak_days,
    coalesce((
      SELECT max(s.streak_len)
      FROM streaks s
      WHERE s.activity_type = l.activity_type
    ), 0) AS longest_streak_days,
    coalesce(c.sessions_last_7d, 0) AS sessions_last_7d,
    coalesce(c.sessions_last_30d, 0) AS sessions_last_30d,
    l.last_active_date
  FROM latest l
  LEFT JOIN counts c ON c.activity_type = l.activity_type;
$$;

GRANT EXECUTE ON FUNCTION public.get_consistency_metrics(uuid) TO authenticated;
