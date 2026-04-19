-- Hardens activity analytics:
--   1. Revokes direct SELECT on the materialized view (RLS not supported on MVs)
--   2. Recreates the MV with a safe bool_or cast and edits_resolved as a meaningful event
--   3. Replaces RPCs with SECURITY DEFINER + auth.uid() — removes the caller-supplied p_user_id
--      that allowed any authenticated user to query another user's data
--   4. Adds a sanity-check assertion so the migration fails loudly if the revoke didn't land

-- ---------------------------------------------------------------------------
-- 1. Drop the old materialized view (revoke first in case it exists)
-- ---------------------------------------------------------------------------

-- Revoke before drop in case MV already exists from a prior migration run.
-- The critical revoke after CREATE below is what actually seals the new object.
REVOKE ALL ON public.user_activity_sessions FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Recreate the materialized view with:
--    - guarded bool_or cast (jsonb_typeof check prevents invalid ::boolean cast)
--    - edits_resolved added as a meaningful resume event
-- ---------------------------------------------------------------------------

DROP MATERIALIZED VIEW IF EXISTS public.user_activity_sessions;

CREATE MATERIALIZED VIEW public.user_activity_sessions AS
WITH meaningful_events AS (
  SELECT
    user_id,
    activity_type,
    session_id,
    event_type,
    metadata,
    duration_seconds,
    created_at
  FROM public.activity_events
  WHERE
    (activity_type = 'resume' AND event_type IN (
      'edit_committed',
      'resume_saved',
      'ai_tailor_triggered',
      'version_created',
      'edits_resolved'
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
  session_id,
  (max(created_at) AT TIME ZONE 'UTC')::date                                              AS session_date,
  min(created_at)                                                                          AS started_at,
  max(created_at)                                                                          AS ended_at,
  coalesce(max(duration_seconds), 0)::integer                                              AS session_duration_seconds,
  count(*)::int                                                                             AS event_count,
  bool_or(
    event_type = 'session_completed'
    OR (jsonb_typeof(metadata->'completed') = 'boolean' AND (metadata->>'completed')::boolean)
  )                                                                                         AS completed
FROM meaningful_events
GROUP BY user_id, activity_type, session_id
WITH NO DATA;

CREATE UNIQUE INDEX user_activity_sessions_user_activity_session_idx
  ON public.user_activity_sessions (user_id, activity_type, session_id);

CREATE INDEX user_activity_sessions_user_date_idx
  ON public.user_activity_sessions (user_id, session_date DESC);

REFRESH MATERIALIZED VIEW public.user_activity_sessions;

-- Lock down the newly created MV. Supabase's default grants restore SELECT on
-- every new object in the public schema, so this REVOKE MUST come after CREATE.
REVOKE ALL ON public.user_activity_sessions FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Drop old parameter-based RPCs and replace with SECURITY DEFINER versions
--    that scope to auth.uid() — callers can no longer pass an arbitrary user_id
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.get_consistency_metrics(uuid);
DROP FUNCTION IF EXISTS public.get_daily_duration(uuid);

CREATE OR REPLACE FUNCTION public.get_consistency_metrics()
RETURNS TABLE (
  activity_type        text,
  current_streak_days  int,
  longest_streak_days  int,
  sessions_last_7d     int,
  sessions_last_30d    int,
  last_active_date     date
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH sessions AS (
    SELECT activity_type, session_date
    FROM public.user_activity_sessions
    WHERE user_id = auth.uid()
  ),
  session_days AS (
    SELECT DISTINCT activity_type, session_date FROM sessions
  ),
  grouped AS (
    SELECT
      activity_type,
      session_date,
      session_date - (row_number() OVER (
        PARTITION BY activity_type ORDER BY session_date))::int AS streak_group
    FROM session_days
  ),
  streaks AS (
    SELECT
      activity_type,
      min(session_date) AS start_date,
      max(session_date) AS end_date,
      count(*)::int     AS streak_len
    FROM grouped
    GROUP BY activity_type, streak_group
  ),
  latest AS (
    SELECT activity_type, max(session_date) AS last_active_date
    FROM session_days
    GROUP BY activity_type
  ),
  counts AS (
    SELECT
      activity_type,
      count(*) FILTER (WHERE session_date >= current_date - 6)::int  AS sessions_last_7d,
      count(*) FILTER (WHERE session_date >= current_date - 29)::int AS sessions_last_30d
    FROM sessions
    GROUP BY activity_type
  )
  SELECT
    l.activity_type,
    coalesce((
      SELECT s.streak_len FROM streaks s
      WHERE s.activity_type = l.activity_type AND s.end_date >= current_date - 1
      ORDER BY s.end_date DESC LIMIT 1
    ), 0) AS current_streak_days,
    coalesce((
      SELECT max(s.streak_len) FROM streaks s WHERE s.activity_type = l.activity_type
    ), 0) AS longest_streak_days,
    coalesce(c.sessions_last_7d,  0) AS sessions_last_7d,
    coalesce(c.sessions_last_30d, 0) AS sessions_last_30d,
    l.last_active_date
  FROM latest l
  LEFT JOIN counts c ON c.activity_type = l.activity_type;
$$;

REVOKE ALL ON FUNCTION public.get_consistency_metrics() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_consistency_metrics() TO authenticated;

-- Drop the no-arg version before recreating with a parameterised signature.
DROP FUNCTION IF EXISTS public.get_daily_duration();

-- p_start_date / p_end_date default to the last 7 days so that
-- ConsistencyMetricsContext can continue calling this with no arguments.
CREATE FUNCTION public.get_daily_duration(
  p_start_date date DEFAULT current_date - 6,
  p_end_date   date DEFAULT current_date + 1
)
RETURNS TABLE (
  activity_type    text,
  practice_date    date,
  duration_minutes int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    activity_type,
    session_date                                                         AS practice_date,
    ROUND(COALESCE(SUM(session_duration_seconds), 0) / 60.0)::int       AS duration_minutes
  FROM public.user_activity_sessions
  WHERE user_id      = auth.uid()
    AND session_date >= p_start_date
    AND session_date  < p_end_date
  GROUP BY activity_type, session_date
  ORDER BY activity_type, session_date ASC;
$$;

REVOKE ALL ON FUNCTION public.get_daily_duration(date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_daily_duration(date, date) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Sanity check — fail fast if the revoke didn't take effect
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.role_table_grants
    WHERE table_name    = 'user_activity_sessions'
      AND table_schema  = 'public'
      AND grantee       IN ('anon', 'authenticated')
      AND privilege_type = 'SELECT'
  ) THEN
    RAISE EXCEPTION 'SECURITY: user_activity_sessions is still SELECTable by anon/authenticated';
  END IF;
END;
$$;
