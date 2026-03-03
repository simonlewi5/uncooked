# Uncooked — Contributor Guide

AI-powered interview prep tool. Monorepo managed with Turborepo + pnpm workspaces.

## Stack

| Layer | Tech |
|---|---|
| Frontend | Vite + React 18 + TypeScript, React Router v6, CSS Modules |
| Backend | Supabase Edge Functions (Deno) |
| Shared types | `packages/shared` |
| Build | Turborepo + pnpm workspaces |
| Deploy | Vercel (frontend) + Supabase (backend) |
| CI | GitHub Actions |
| Testing | Vitest + @testing-library/react |

## Local setup

```bash
cp apps/web/.env.example apps/web/.env.local   # add Supabase creds
pnpm install
pnpm dev           # starts all workspaces in parallel (turbo)
```

`apps/web` runs on http://localhost:5173 by default.

## Folder structure

```
apps/web/src/
  components/
    ui/          # Primitive reusable components (Button, Input, …)
    interview/   # Feature components for the interview simulator
    AppShell.tsx # Top-level nav shell
  contexts/      # React contexts (AuthContext)
  hooks/         # Custom hooks (useInterviewChat, …)
  lib/           # External client setup (supabase.ts)
  pages/         # One file per route
  types/         # Shared frontend TypeScript types
  utils/         # Pure utility functions (cn.ts)

supabase/
  functions/     # Deno edge functions
    _shared/     # Shared helpers (cors.ts)
```

## How to add a page

1. Create `src/pages/MyPage.tsx` and `MyPage.module.css`
2. Add a `<Route>` in `src/App.tsx` inside the `AppShell` route
3. Add a nav link entry in `AppShell.tsx → NAV_LINKS` if it needs global nav

## How to add a UI component

1. Create `src/components/ui/MyComponent.tsx` + `MyComponent.module.css`
2. Use CSS custom properties from `src/index.css` — never hard-code colours or spacing
3. Export from `src/components/ui/index.ts`

## How to add an Edge Function

```bash
supabase functions new my-function
```

- Add CORS handling using `supabase/functions/_shared/cors.ts`
- Call the function from the frontend via the Supabase client (`supabase.functions.invoke`)

## Code conventions

- **Path alias**: `@/*` maps to `apps/web/src/*`
- **Styles**: CSS Modules (`.module.css`) only — no inline styles except one-offs
- **Class names**: use the `cn()` helper from `@/utils/cn` for conditional classes
- **Formatting**: single quotes, no semicolons, 100-char line width (Prettier)
- **Components**: named exports for UI primitives, default exports for pages
- **No barrel re-exports** from pages or hooks — import them directly

## Anti-patterns to avoid

- Don't install styling libraries (Tailwind, styled-components, etc.) — use CSS Modules
- Don't add `clsx`/`classnames` — use the `cn()` util already in the codebase
- Don't use `any` — write the actual type
- Don't commit secrets — use `.env.local` (git-ignored)
- Don't push to `main` directly — open a PR; CI must pass + 1 review required
