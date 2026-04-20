-- Starter content helper.
--
-- Defines `public.seed_starter_content(p_user_id uuid)`: inserts a
-- curated "starter pack" of company profiles, research sessions, and
-- interview sessions for the given user. The migration itself makes no
-- data changes — it only creates the function.
--
-- A team member applies this per test account:
--   SELECT public.seed_starter_content('00000000-0000-0000-0000-000000000000'::uuid);
-- or by email:
--   SELECT public.seed_starter_content(id)
--   FROM auth.users WHERE email = 'test@example.com';
--
-- Idempotent: existing rows matching the starter prefixes are deleted
-- before reinsert, so re-running is safe.

CREATE OR REPLACE FUNCTION public.seed_starter_content(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_anthropic_company_id uuid;
  v_google_company_id    uuid;
  v_stripe_company_id    uuid;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'seed_starter_content: p_user_id is required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'seed_starter_content: user % not found in public.users', p_user_id;
  END IF;

  -- Remove any prior starter rows for this user so the function is idempotent.
  DELETE FROM public.interview_sessions
   WHERE user_id = p_user_id
     AND job_description LIKE '[STARTER]%';

  DELETE FROM public.research_sessions
   WHERE user_id = p_user_id
     AND title LIKE 'Starter: Research —%';

  DELETE FROM public.company_profiles
   WHERE user_id = p_user_id
     AND notes LIKE '[STARTER]%';

  -- ------------------------------------------------------------
  -- Company profiles
  -- ------------------------------------------------------------

  INSERT INTO public.company_profiles (
    user_id, company_name, company_website, industry, company_size, location, notes, is_favorite
  )
  VALUES (
    p_user_id,
    'Anthropic',
    'https://anthropic.com',
    'AI Research',
    '500-1000',
    'San Francisco, CA',
    '[STARTER] Safety-focused AI lab building Claude. Dual tracks: research (alignment, interp) and product/infra. Interview loop emphasizes values alignment and careful technical reasoning.',
    true
  )
  RETURNING id INTO v_anthropic_company_id;

  INSERT INTO public.company_profiles (
    user_id, company_name, company_website, industry, company_size, location, notes, is_favorite
  )
  VALUES (
    p_user_id,
    'Google',
    'https://google.com',
    'Internet / Cloud',
    '100000+',
    'Mountain View, CA',
    '[STARTER] Broad ladder (L3–L8+), structured interview loop, calibrated scoring. Core / Cloud / DeepMind tracks. Behavioral rubric maps to Googleyness + leadership.',
    true
  )
  RETURNING id INTO v_google_company_id;

  INSERT INTO public.company_profiles (
    user_id, company_name, company_website, industry, company_size, location, notes, is_favorite
  )
  VALUES (
    p_user_id,
    'Stripe',
    'https://stripe.com',
    'Fintech / Payments',
    '5000-10000',
    'San Francisco, CA',
    '[STARTER] Payments infra, very high writing bar, reading-heavy culture (Stripe Press). Bug bash + system design on-site. Values rigor, clarity, and long-term thinking.',
    true
  )
  RETURNING id INTO v_stripe_company_id;

  -- ------------------------------------------------------------
  -- Research sessions (substantive multi-turn conversations)
  -- ------------------------------------------------------------

  INSERT INTO public.research_sessions (user_id, company_profile_id, title, messages)
  VALUES (
    p_user_id,
    v_anthropic_company_id,
    'Starter: Research — Anthropic',
    jsonb_build_array(
      jsonb_build_object('role','user','content','Can you give me a high-level read on Anthropic as an employer? I''m prepping for interviews.'),
      jsonb_build_object('role','assistant','content','Anthropic is an AI safety company founded in 2021 by ex-OpenAI researchers (Dario and Daniela Amodei among them). Their flagship product is Claude — a family of LLMs — and the company''s through-line is that frontier capability and safety research should progress together. Culturally: high trust, research-adjacent even for product engineers, and an unusually strong emphasis on careful reasoning about tradeoffs. Headcount has grown fast (roughly 500–1000 as of recent public reporting) but decision-making still reads as thoughtful rather than bureaucratic.'),
      jsonb_build_object('role','user','content','How is the interview loop structured, especially for a software engineer?'),
      jsonb_build_object('role','assistant','content','Expect roughly: (1) a recruiter screen focused on motivation and safety interest, (2) a technical phone screen (live coding, often on a realistic problem rather than a leetcode puzzle), (3) an on-site or virtual loop with 4–5 rounds — typically a coding round, a systems/design round tailored to the role (inference infra, product APIs, evals), a behavioral round, and a "values alignment" or mission-fit round. Research engineer and MTS roles add an ML depth or paper-discussion round.'),
      jsonb_build_object('role','user','content','What does the "values alignment" round actually look like? I''ve heard it''s unusual.'),
      jsonb_build_object('role','assistant','content','It''s conversational but not fluffy. You''ll be asked about how you reason about risks from advanced AI, what responsible deployment looks like to you, and how you''d handle disagreement with a team about shipping something you thought was premature. Good answers show that you''ve actually thought about tradeoffs — not talking-point safety, not dismissive "AI is just a tool." Read the Core Views post and recent Responsible Scaling Policy before the loop.'),
      jsonb_build_object('role','user','content','What technical areas should I brush up on?'),
      jsonb_build_object('role','assistant','content','For most SWE roles: strong Python, distributed systems fundamentals (batching, throughput, failure modes under load), and at least surface familiarity with transformer architecture. For infra-leaning roles: CUDA/GPU scheduling, inference serving patterns (continuous batching, speculative decoding), and cost/latency tradeoffs. For product roles: API design, streaming, long-context UX. For research engineer: you should be able to implement a small transformer from scratch and reason about scaling behavior.'),
      jsonb_build_object('role','user','content','What''s Anthropic''s current strategic position vs. OpenAI and Google DeepMind?'),
      jsonb_build_object('role','assistant','content','Shorter version: Anthropic is a close second or co-leader on frontier model capability, ahead on interpretability research, and differentiated commercially via enterprise/API distribution (notably AWS and Google Cloud partnerships). They tend to ship fewer but more carefully positioned models. Publicly they''ve committed to not racing ahead of safety — that shapes product cadence.'),
      jsonb_build_object('role','user','content','Anything specific they look for in "how we work" behavioral rounds?'),
      jsonb_build_object('role','assistant','content','High-signal traits: being honest about what you don''t know, taking disagreement seriously without being combative, proactively raising concerns you think others have missed, and moving fast on things that are reversible while slowing down on things that aren''t. Thin-sliced version: they want to hire people who would push back on their own manager if they thought something was being shipped irresponsibly.')
    )
  );

  INSERT INTO public.research_sessions (user_id, company_profile_id, title, messages)
  VALUES (
    p_user_id,
    v_google_company_id,
    'Starter: Research — Google',
    jsonb_build_array(
      jsonb_build_object('role','user','content','Give me a quick read on what it''s like to interview at Google today.'),
      jsonb_build_object('role','assistant','content','Google''s loop is the most structured of the big AI labs. Every interviewer writes detailed written feedback mapped against a shared rubric, and a hiring committee — separate from the interviewers — makes the final call. That means individual interviewers have less discretion than at most companies, which cuts both ways: more fair, but also harder to overcome a single rough round.'),
      jsonb_build_object('role','user','content','Walk me through the stages.'),
      jsonb_build_object('role','assistant','content','Typical path: (1) recruiter phone screen, (2) one technical phone interview (45 min, coding), (3) on-site loop of 4–5 rounds — two coding, one system design (for senior+), one "Googleyness and Leadership" behavioral, sometimes a domain-specific round. After on-sites, packet goes to hiring committee, then team matching — you can be "hire" but still not get placed if no team wants you.'),
      jsonb_build_object('role','user','content','What''s the coding bar like? Leetcode-style?'),
      jsonb_build_object('role','assistant','content','Yes, but the expectations are less about clever trick problems and more about clean, correct, well-communicated code. You''re scored on: problem clarification, correctness, code quality, and communication. A flawless medium problem tends to outperform a half-solved hard one. Interviewers are looking for "would I want this person debugging production at 2am" more than "can they solve a puzzle."'),
      jsonb_build_object('role','user','content','What about system design? How does it differ by level?'),
      jsonb_build_object('role','assistant','content','L4: one system of moderate complexity, maybe a URL shortener or rate limiter, with clean API and storage choices. L5: distributed system with real scale concerns (cache invalidation, sharding, consistency). L6+: ambiguous problem requiring you to drive scope, identify the non-obvious bottleneck, and reason about organizational/deployment tradeoffs. Google strongly weights the ability to estimate (QPS, storage, latency budgets) from first principles.'),
      jsonb_build_object('role','user','content','What do they mean by "Googleyness"?'),
      jsonb_build_object('role','assistant','content','Colloquially it means: comfort with ambiguity, bias toward collaboration over solo heroics, intellectual humility, and user-first thinking. In practice the behavioral round probes: how do you handle disagreement with a tech lead, when have you changed your mind based on data, how do you make a decision without full information. Answers anchored in specific examples (STAR format) substantially outperform general statements.'),
      jsonb_build_object('role','user','content','Anything recent about Gemini or the AI org I should reference?'),
      jsonb_build_object('role','assistant','content','Gemini is now integrated across nearly every surface (Search, Workspace, Android, Cloud). Knowing the rough capability tier (Pro vs. Ultra vs. Flash), recent context-length pushes, and where they''re differentiated vs. Claude/GPT is table stakes. If you''re interviewing into DeepMind or Core ML infra, familiarity with the published research around Gemini (especially recent Nature or arXiv papers) is a strong signal.')
    )
  );

  INSERT INTO public.research_sessions (user_id, company_profile_id, title, messages)
  VALUES (
    p_user_id,
    v_stripe_company_id,
    'Starter: Research — Stripe',
    jsonb_build_array(
      jsonb_build_object('role','user','content','What''s the culture at Stripe actually like? I''ve heard a lot about the writing culture.'),
      jsonb_build_object('role','assistant','content','The writing culture is real and load-bearing. Almost every substantive decision at Stripe is made via written documents (one-pager, six-pager, or longer), debated asynchronously, and linked forward as reference material. New hires are expected to read heavily in their first weeks. It has a huge flywheel effect: institutional memory is preserved in text, not in heads, which is unusual at their scale.'),
      jsonb_build_object('role','user','content','How does that show up in the interview loop?'),
      jsonb_build_object('role','assistant','content','Most engineering loops include an on-site "take-home" style module — sometimes called the bug bash — where you''re given an unfamiliar codebase and asked to find, fix, and explain issues. It''s evaluating exactly the skill you''ll need on day one: navigating a large, mature, heavily-documented codebase under time pressure. Also expect a system design round, a coding round, and at least one behavioral round scoped to Stripe''s operating principles.'),
      jsonb_build_object('role','user','content','What are Stripe''s operating principles I should be familiar with?'),
      jsonb_build_object('role','assistant','content','A few they emphasize publicly: "users are why we''re here" (user empathy trumps internal concerns), "move with urgency and focus," "optimize globally" (avoid local optima at the expense of the company), "trust and amplify" (high trust, extend it outward), and "seek feedback." The behavioral round will probe for examples that map to these — especially "optimize globally" which distinguishes Stripe-level senior engineers from strong engineers elsewhere.'),
      jsonb_build_object('role','user','content','What''s the bar like for the system design round?'),
      jsonb_build_object('role','assistant','content','Payments-flavored. You''ll often be asked to design something with strong consistency, idempotency, and failure-recovery requirements — e.g., a ledger, a webhook delivery system, a rate-limited API gateway for merchants. Correctness under partial failure matters more than raw throughput. Interviewers push on: what happens if this service crashes mid-transaction, how do you detect duplicate events, how do you reconcile a mismatch.'),
      jsonb_build_object('role','user','content','How about the business trajectory — IPO, growth, anything I should know?'),
      jsonb_build_object('role','assistant','content','Stripe is one of the largest private fintech companies globally, with recurring IPO speculation. They''ve expanded well beyond card-processing — Atlas (company formation), Radar (fraud), Issuing (card issuing), Terminal (in-person), Connect (marketplaces), and increasing enterprise footprint. Financially disciplined: a couple of rounds of layoffs in recent years reshaped the org toward the core payments and enterprise growth areas.'),
      jsonb_build_object('role','user','content','Any reading recommendations before the loop?'),
      jsonb_build_object('role','assistant','content','Yes, a few: Patrick Collison''s personal site (patrickcollison.com) — his "Fast" and "Advice" pages sketch the leadership style; Stripe Press publishes a handful of books you''ll hear referenced internally (The Dream Machine, High Growth Handbook); and Stripe''s engineering blog is unusually high-signal on production-grade payments infrastructure. If you mention a Stripe Press book you''ve read in the behavioral round, do it naturally — not as a flex.')
    )
  );

  -- ------------------------------------------------------------
  -- Interview sessions (behavioral + system design exchanges)
  -- ------------------------------------------------------------

  INSERT INTO public.interview_sessions (
    user_id, company_profile_id, company_name, job_description, interview_style, messages
  )
  VALUES (
    p_user_id,
    v_anthropic_company_id,
    'Anthropic',
    '[STARTER] Mock interview for Software Engineer, Product. Mixed behavioral + system design, emphasis on reasoning under uncertainty and safety-adjacent tradeoffs.',
    'behavioral_plus_system_design',
    jsonb_build_array(
      jsonb_build_object('role','assistant','content','Welcome. I''m going to run a mixed round — first some behavioral, then we''ll move into a design problem. To start: tell me about a time you raised a concern about something your team was about to ship, and walk me through what happened.'),
      jsonb_build_object('role','user','content','We were about to launch a feature flag rollout for a new caching layer, and I noticed late in the week that our rollback script didn''t handle cache-invalidation for in-flight requests. I flagged it in the launch channel.'),
      jsonb_build_object('role','assistant','content','Good. Two follow-ups: what was the actual risk if the rollback had been triggered mid-incident, and how did the team respond when you raised it?'),
      jsonb_build_object('role','user','content','The risk was stale cached responses for up to 15 minutes, which for our flow meant showing wrong pricing. Team response was mixed — the tech lead initially wanted to ship on schedule, but after I wrote up a short doc with the specific failure mode, we delayed 48 hours and added invalidation hooks.'),
      jsonb_build_object('role','assistant','content','Nice — the written doc is the key move there. Last behavioral: tell me about a time you changed your mind after being confident in a position.'),
      jsonb_build_object('role','user','content','I was pushing hard for us to move off a managed queue to self-hosted for cost reasons. A peer ran the actual numbers including our engineering time, and the delta was much smaller than I''d assumed. I dropped it.'),
      jsonb_build_object('role','assistant','content','Good. Moving into design: I''d like you to design a system to safely roll out new Claude model versions to a subset of API traffic. The goal is gradual exposure, fast rollback, and good signal about regressions. Start with the API shape.'),
      jsonb_build_object('role','user','content','I''d keep the public /v1/messages endpoint stable and introduce a routing layer in front. The routing layer consults a config service that specifies per-version traffic weights, optionally scoped by customer tier, region, or request fingerprint.'),
      jsonb_build_object('role','assistant','content','Good — how does a customer opt in or pin to a specific version for reproducibility? That''s a real requirement, not a nice-to-have.'),
      jsonb_build_object('role','user','content','Two mechanisms: an explicit model parameter in the request (e.g., "claude-3-5-sonnet-20241022") that always bypasses the weighted router, and an account-level pin in the config service for enterprise customers who need long-term stability.'),
      jsonb_build_object('role','assistant','content','Now the rollback side. If we detect a regression — say, a spike in refusals or a drop in a downstream eval score — how quickly can we bleed traffic away from the new version, and what''s the blast radius before we notice?'),
      jsonb_build_object('role','user','content','Rollback should be a config-service write that propagates within seconds via push-based update to routers. Blast radius depends on detection latency — I''d want online evals sampling every N requests and alerting on delta > threshold, plus a kill switch wired to pager. Realistically, 1–5 minutes from regression start to traffic fully shifted.'),
      jsonb_build_object('role','assistant','content','Solid. One last thing: what signals would you watch that aren''t obvious — things that might indicate a regression the eval suite missed?'),
      jsonb_build_object('role','user','content','Token-per-request distributions (new version getting wordier or terser), refusal/safety-filter rates, latency tail (p99), and customer-reported issues in support tickets cross-referenced against the rollout timeline. And I''d want a secondary eval loop running on production traffic samples, not just the offline suite.')
    )
  );

  INSERT INTO public.interview_sessions (
    user_id, company_profile_id, company_name, job_description, interview_style, messages
  )
  VALUES (
    p_user_id,
    v_google_company_id,
    'Google',
    '[STARTER] Mock interview for L4/L5 Software Engineer. Structured: one coding warmup, one system design at moderate scale, with behavioral interspersed.',
    'coding_plus_system_design',
    jsonb_build_array(
      jsonb_build_object('role','assistant','content','Hi, I''ll be your interviewer today. We have 45 minutes — I want to spend about 5 on intros, 25 on a design problem, 10 on behavioral, and 5 for your questions. Sound good? Quickly: what''s a system you''ve built or owned that you''re proud of, one sentence.'),
      jsonb_build_object('role','user','content','Sure — I rewrote our notification pipeline from a per-service queue model to a unified event bus with per-consumer retry and DLQ semantics. Cut incident frequency in half.'),
      jsonb_build_object('role','assistant','content','Great. Let''s design: build a URL shortener that handles 10K shortens/sec and 100K redirects/sec globally. Start with clarifying questions, then propose an approach.'),
      jsonb_build_object('role','user','content','Clarifying: do we need custom aliases, analytics on clicks, expiration, and what''s the read/write ratio? Also: single region or multi-region from day one?'),
      jsonb_build_object('role','assistant','content','Custom aliases optional, basic click counts yes, no expiration required, multi-region from day one. Read/write ratio you''ve approximately been given: 100K:10K, so 10:1 reads.'),
      jsonb_build_object('role','user','content','Okay. For the short code I''d use a base62-encoded counter, with a per-region counter range assigned by a central coordinator to avoid collisions. Storage: the short→long mapping goes in a key-value store like Bigtable, replicated per region. For reads, I''d cache hot URLs at the edge — likely a tiered cache with an LRU at the region and a CDN in front.'),
      jsonb_build_object('role','assistant','content','Good. Two pushes: how do you handle the edge case where two regions both think they own the same short code? And for the counter coordinator — is that a single point of failure?'),
      jsonb_build_object('role','user','content','The coordinator hands out non-overlapping counter ranges (say, blocks of a million) on startup. Each region only issues codes from its own block, so no cross-region collision unless the coordinator double-allocates — which I''d prevent with a distributed lock or compare-and-swap on the range registry. The coordinator itself can be a small Paxos/Raft group, not a single node, with the range registry in a consistent store.'),
      jsonb_build_object('role','assistant','content','Nice. How about the click analytics — where do writes land, and how do we count without bottlenecking?'),
      jsonb_build_object('role','user','content','I''d fire-and-forget a click event to a regional write-ahead log (Kafka or equivalent), consumed asynchronously by an aggregator that batches into a time-windowed counter store. The redirect response never blocks on analytics write. Reads of aggregate counts are eventually consistent — a few minutes of lag is fine for this use case.'),
      jsonb_build_object('role','assistant','content','Good. Pivoting to behavioral: tell me about a time you disagreed with a tech lead and how you resolved it.'),
      jsonb_build_object('role','user','content','We had a proposal to move from Postgres to a document store for a user-settings service. I thought it was premature — our query patterns were relational. I pulled the actual query logs from the last month, showed the tech lead that 80% of reads were joins, and we stayed on Postgres. No hard feelings; it was a data-driven disagreement.'),
      jsonb_build_object('role','assistant','content','Clean. Last behavioral: describe a time you made a mistake that had real impact and what you learned.'),
      jsonb_build_object('role','user','content','I shipped a migration without a shadow-read phase because I''d done similar ones before and thought it was low risk. It caused 20 minutes of elevated error rate at peak. Takeaway: shadow-reads for any schema change touching a hot path, even if you''re confident. Muscle memory over ego.')
    )
  );

  INSERT INTO public.interview_sessions (
    user_id, company_profile_id, company_name, job_description, interview_style, messages
  )
  VALUES (
    p_user_id,
    v_stripe_company_id,
    'Stripe',
    '[STARTER] Mock interview for Software Engineer, Payments. Behavioral with operating-principle probes, then a correctness-heavy design problem.',
    'behavioral_plus_system_design',
    jsonb_build_array(
      jsonb_build_object('role','assistant','content','Thanks for the time. I want to dig into some behavioral first — we score against Stripe''s operating principles — then we''ll move to a design problem. First: tell me about a time you caught a subtle correctness bug that would have been easy to ship.'),
      jsonb_build_object('role','user','content','In a payments-adjacent system, I caught that our idempotency key generation was using a client-provided timestamp rather than a deterministic request fingerprint. Meant two identical requests sent within the same millisecond from the same client could generate duplicate charges under retry. Fixed it by switching to a server-derived hash.'),
      jsonb_build_object('role','assistant','content','Great catch. What signaled it to you — code review, testing, production incident?'),
      jsonb_build_object('role','user','content','Code review. I was reviewing a PR that was adjacent to the idempotency logic and got curious about how keys were being generated. Traced through and spotted the timestamp dependency. Wrote a short doc with the failure case and a repro test before filing the bug.'),
      jsonb_build_object('role','assistant','content','Good — the doc-first habit maps to our writing culture. Next: tell me about a time you made a globally-optimal decision that was locally painful for your team.'),
      jsonb_build_object('role','user','content','My team had built a custom auth library because no shared one existed. When the platform team eventually shipped a company-wide one, I pushed to migrate us even though our version had features theirs lacked. We lost two weeks of work and had to rebuild a custom layer on top, but long-term it meant we got security patches for free and reduced cross-team complexity.'),
      jsonb_build_object('role','assistant','content','Clean example of "optimize globally." Moving to design: I want you to design a system that delivers webhooks to merchants. Requirements: at-least-once delivery, retries with backoff, visibility into delivery state, and the merchant''s side can be down for hours.'),
      jsonb_build_object('role','user','content','I''d model each webhook as an immutable event in a ledger table. A separate delivery table tracks attempts per (event, endpoint), with status (pending/succeeded/failed), attempt count, and next_retry_at. A worker pool polls for deliveries where next_retry_at <= now, POSTs to the merchant''s endpoint, and updates state.'),
      jsonb_build_object('role','assistant','content','Good shape. What''s the retry policy and how do you keep a slow merchant from drowning the worker pool?'),
      jsonb_build_object('role','user','content','Exponential backoff with jitter — say, 30s, 2m, 10m, 1h, 6h, 24h, up to a cap of maybe 72 hours of retries. For the drowning problem: per-merchant concurrency limits enforced at the worker level, plus circuit-breaker logic — if a merchant returns 5xx at high rate, we shift to a slow-drip dedicated queue for that merchant instead of blocking the shared pool.'),
      jsonb_build_object('role','assistant','content','Good. What about ordering? A merchant probably cares that "payment_created" arrives before "payment_succeeded" for the same payment.'),
      jsonb_build_object('role','user','content','Two options — strict per-resource ordering via a sequential worker keyed by resource_id, or best-effort ordering with merchant-side deduplication using the event_id and timestamp. I''d default to best-effort, because strict ordering creates head-of-line blocking: one stuck event for a resource delays all subsequent events for that resource. Document the non-guarantee clearly in the webhook contract.'),
      jsonb_build_object('role','assistant','content','Agree — and Stripe does in fact document that. Last one: how does a merchant debug when they think they''re missing events?'),
      jsonb_build_object('role','user','content','A dashboard that shows, for each event: the delivery attempts, response codes, response bodies (truncated), and next retry time. Plus a replay API — the merchant can request redelivery for a given event or range. And an events-since-cursor API so they can reconcile by polling after an outage. All of this backed by the immutable event ledger, so there''s a single source of truth.')
    )
  );

END;
$$;

REVOKE ALL ON FUNCTION public.seed_starter_content(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seed_starter_content(uuid) TO service_role;

COMMENT ON FUNCTION public.seed_starter_content(uuid) IS
  'Seeds starter company profiles, research sessions, and interview sessions for the given user. Idempotent. Service-role only — callers must run via a privileged context (e.g., Supabase SQL editor or an admin script).';
