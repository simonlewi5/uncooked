# Gamification System

## Overview

The gamification system rewards users for activity across the app — mock interview practice, company research, and job application tracking. It surfaces a **Career Progress** card on the Dashboard showing the user's current level, XP progress, tier title, and earned badges.

Everything is derived from existing activity data. No separate write path is required to earn XP.

---

## XP Model

XP is computed by counting rows the user already owns across three tables and applying a fixed multiplier to each:

| Activity | Table | XP per action |
|---|---|---|
| Complete a mock interview session | `practice_sessions` | 50 XP |
| Research a company | `research_sessions` | 25 XP |
| Track a job application | `job_applications` | 20 XP |

**Formula:**

```
totalXp = (practiceCount × 50) + (researchCount × 25) + (applicationCount × 20)
```

---

## Levels

Every **200 XP** advances the user one level, starting at Level 1.

```
level        = floor(totalXp / 200) + 1
xpInLevel    = totalXp % 200
xpForNext    = 200
progressPct  = round((xpInLevel / 200) × 100)
```

There is no level cap.

---

## Tiers

Tiers are cosmetic title labels that change at level milestones:

| Minimum Level | Tier Title |
|---|---|
| 1 | Job Seeker |
| 3 | Candidate |
| 6 | Contender |
| 10 | Interview Ace |
| 15 | Top Talent |

---

## Badges

Badges are evaluated each time the hook loads. There is no separate badge state stored in the database — the `earned` flag is re-derived from live counts on every fetch.

| Badge | Icon | Unlock Condition |
|---|---|---|
| First Move | 🎯 | Complete 1 mock interview session |
| Researcher | 🔬 | Research 3 companies |
| Pipeline Builder | 💼 | Track 1 job application |
| Interview Pro | 🏆 | Complete 5 mock interview sessions |
| Champion | ⭐ | Earn 500 XP total |

Locked badges are displayed greyed out with a tooltip showing the unlock requirement.

---

## Architecture

### Data flow

```
practice_sessions  ─┐
research_sessions  ─┼─▶  useGamificationData  ──▶  GamificationCard
job_applications   ─┘         (hook)                (component)
```

All three count queries are fired in parallel via `Promise.all` — the same pattern used by `useDashboardData`.

### Files

| File | Role |
|---|---|
| `apps/web/src/hooks/useGamificationData.ts` | Fetches counts, computes XP/level/badges, returns `GamificationData` |
| `apps/web/src/components/dashboard/GamificationCard.tsx` | Renders the Dashboard card |
| `apps/web/src/components/dashboard/GamificationCard.module.css` | Card styles |
| `apps/web/src/types/index.ts` | `Badge` and `GamificationData` interfaces |
| `supabase/migrations/20260308000009_create_gamification_tables.sql` | `user_xp_events` ledger table |

### Separation of concerns

The hook owns all computation logic. The component receives a fully-resolved `GamificationData` object and has no XP math. Replacing the computation engine (e.g. switching to a DB-aggregated Postgres function) only requires changing the hook — the card is unaffected.

---

## Database: `user_xp_events`

Migration `20260308000009` creates an event ledger for future use:

```sql
CREATE TABLE user_xp_events (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type   TEXT        NOT NULL,
  xp_awarded   INTEGER     NOT NULL CHECK (xp_awarded > 0),
  reference_id UUID,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

This table is **not currently queried** by `useGamificationData` — XP is derived from activity counts instead. The table exists to support:

- Trigger-based automatic XP awards (e.g. award 50 XP on insert to `practice_sessions`)
- Manual/admin bonus XP grants
- Historical audit trail of all XP events
- Future leaderboard or social features

RLS is enabled: users can only read or insert their own rows.

---

## Adding a New Badge

1. Add a new entry to `BADGE_DEFS` in `useGamificationData.ts`:

```ts
{
  id: 'my_badge',
  label: 'My Badge',
  description: 'Do something five times',
  icon: '🚀',
  check: ({ practice }) => practice >= 5,
},
```

The `check` function receives `{ practice, research, applications, totalXp }`. No other files need to change.

## Adding a New XP Source

1. Add a constant for the XP value at the top of `useGamificationData.ts`
2. Add the query to the `Promise.all` block
3. Add the count to the `totalXp` calculation
4. Add the count to the `Counts` object so badges can reference it
