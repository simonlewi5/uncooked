# Agile Planning

## Team Context

Our team consists of working professionals. We operate async-first using Discord and GitHub Issues, with necessary meetings held on weekends.

## Tools

- **GitHub Projects** - Backlog management, sprint tracking, priorities, and due dates
- **GitHub Issues** - Task breakdown, acceptance criteria, and blocking relationships
- **Discord** - Async communication and quick decisions

## Backlog

We maintain our product backlog in [GitHub Projects](https://github.com/users/simonlewi5/projects/2). Items are prioritized by value and effort (P0 → P1 → P2) and sized (XS → XL). Anyone can add items; the team refines priorities async via Discord or during weekend syncs.

## User Stories

We write user stories in GitHub Issues using this format:

```
As a [type of user],
I want [goal],
so that [benefit].
```

Acceptance criteria are added as a checklist in the issue body. Blocking relationships are noted in comments using **Blocked by:** / **Blocks:** conventions.

## Sprint Planning

- **Sprint length:** 2 weeks
- **Planning:** Async via GitHub Projects; weekend call if needed
- **Daily standups:** Async updates in Discord
- **Review/Retro:** Weekend call at sprint end

We pull work from the backlog into the current sprint. Each team member self-assigns issues they commit to completing. Issues are only picked up once their blockers are resolved.

## Definition of Done

An issue is **Done** when:
- [ ] Code is merged to `main` via a reviewed PR
- [ ] CI pipeline passes (lint, type check, unit tests)
- [ ] All acceptance criteria in the issue are checked off
- [ ] No known regressions introduced

## Sprint Schedule

| Sprint | Dates | Goal | Key Issues |
|--------|-------|------|------------|
| Sprint 1 | Feb 10 – Feb 23 | Planning, design, user scenarios, agile setup | #9–#13, #15, #22–#24 |
| Sprint 2 | Feb 24 – Mar 9 | Foundation + Interview Simulator end-to-end | #19, #25–#28, #37, #16–#18, #20–#21, #35–#36 |
| Sprint 3 | Mar 10 – Apr 6 | Research Board + Resume Editor | #29–#34 |
| Sprint 4 | Apr 7 – Apr 27 | MVP polish, QA, bug fixes, demo prep | TBD |

> Spring Recess: Mar 16–22 (no sprint work expected)
> Written Exam: Mar 23

## Sprint 2 Dependency Order

The critical path for Sprint 2 (must be done in this order):

```
#25 DB Schema SPIKE
  └─> #26 Supabase Auth
        └─> #27 Login/Signup Page
              └─> #28 App Shell & Nav
                    └─> #18 Interview Simulator Page
                          ├─> #16 Job Description Form ──> #20 AI: Job Desc Endpoint ──> #21 AI: Chat Endpoint
                          │         └─> #35 Interview Style Selector                           └─> #36 Conversation History
                          └─> #17 AI Chat Box ────────────────────────────────────────────────────────^

#19 AI Backend SPIKE ──> #20, #21 (model + prompt decisions)
#37 CI/CD ──────────── (can run in parallel from day 1)
```

## Key Milestones

| Date | Event |
|------|-------|
| Feb 23 | **Demo #1** — UI/UX, MVP user scenarios, agile planning, tech stack, test plan |
| Mar 9  | **Demo #2** — Software quality metrics review |
| Apr 13 | **MVP Demo #1** |
| Apr 20 | **MVP Demo #2** |
| Apr 27 | **MVP Demo #3** |
