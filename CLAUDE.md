# CLAUDE.md — fairPath Frontend

AI assistant guide for understanding and contributing to the fairPath Frontend codebase.

---

## Project Overview

**fairPath-Frontend** is a job portal web application. Users can search for jobs, save listings, manage their profile, and upload their resume. The frontend proxies requests to a Spring Boot backend.

**Live stack:**
- Next.js 16 (App Router, React Server Components, Server Actions)
- React 19 / TypeScript 5 (strict)
- Tailwind CSS v4 + shadcn/ui (New York style, stone base color)
- axios for HTTP, Zod for validation, Sonner for toasts

---

## Repository Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/             # Route group: login, signup, forgot-password, update-password, verify
│   ├── dashboard/          # Protected routes: home, search-results, profile, saved-jobs
│   ├── api/                # Next.js API route handlers (proxy to Spring backend)
│   │   ├── auth/
│   │   ├── jobs/
│   │   └── dashboard/
│   ├── layout.tsx          # Root layout (Sonner ToastProvider)
│   ├── page.tsx            # Home/landing page
│   └── globals.css         # Tailwind directives + CSS custom properties (theme)
├── components/
│   ├── ui/                 # shadcn/ui primitives (button, input, dialog, etc.)
│   ├── shared/             # Layout-level components (Navbar, Footer, Sidebar, HeroSection)
│   ├── search-results/     # JobTable, JobCard, JobFilters, FilterButton
│   ├── dashboard/          # DashboardSearch and related
│   ├── profile/            # ResumeDropdown, profile forms
│   ├── saved-jobs/         # Saved jobs display
│   ├── forgot-password/    # Password reset forms
│   └── verify/             # Email verification form
├── hooks/
│   ├── use-mobile.ts       # Responsive breakpoint detection
│   └── useIsDarkMode.ts    # System dark mode detection
├── lib/
│   ├── utils.ts            # cn() helper (clsx + tailwind-merge)
│   └── server-api-client.ts # Authenticated server-side fetch
└── types/
    ├── User.ts
    ├── Job.ts
    ├── action-result.ts    # { ok: boolean; error?: string }
    └── ResumePresignUrlResponse.ts
```

---

## Development Workflow

### Commands

```bash
npm run dev          # Start dev server (Next.js + Turbopack)
npm run build        # Production build
npm run start        # Production server
npm run lint         # ESLint check
npm run format       # Prettier write (fix)
npm run format:check # Prettier check (CI)
```

### Environment Variables

Create `.env.local` at the repo root (never committed):

```
SPRING_BASE_URL=http://localhost:8080
```

All API routes and the server-side client fall back to `http://localhost:8080` when this is unset.

### Pre-commit Hooks (Husky + lint-staged)

Every commit automatically runs:
1. `prettier --write` on staged files
2. `eslint --fix` on staged `.ts`/`.tsx` files

Do not bypass with `--no-verify` unless explicitly instructed.

### CI (GitHub Actions)

`.github/workflows/lint-format.yml` runs on PRs to `main`:
- `npm ci`
- `npm run lint`
- `npm run format:check`

All checks must pass before merge.

---

## Key Conventions

### TypeScript

- **Strict mode** is enabled — no implicit `any`, no unchecked nulls.
- All shared shapes live in `src/types/`. Add new types there.
- Use the result type pattern for server actions:
  ```ts
  type ActionResult = { ok: boolean; error?: string };
  ```
- Import paths use the `@/*` alias (maps to `src/`).

### Component Conventions

| Concern | Convention |
|---|---|
| File names in `components/ui/` | kebab-case (`input-otp.tsx`) |
| All other component files | PascalCase (`JobCard.tsx`) |
| Client components | Add `'use client'` at the top |
| Server components | Default — no directive needed |
| className merging | Always use `cn()` from `@/lib/utils` |
| Component variants | Use `class-variance-authority` (CVA) |

### Routing & Layouts

- `(auth)/` — unauthenticated route group, minimal layout
- `dashboard/` — protected; guarded by server-side auth check via `serverApiFetch`
- API routes under `app/api/` are thin proxies to the Spring backend

### Authentication

- JWT token stored in an **httpOnly cookie** (`authToken`)
- `server-api-client.ts` reads the cookie on the server and injects `Authorization: Bearer <token>`
- 401/403 responses from the backend redirect to `/login` automatically
- Cookie is set as `secure` in production, `sameSite: lax`

### Data Fetching

| Where | How |
|---|---|
| Server components / layouts | `serverApiFetch()` from `@/lib/server-api-client` |
| Client components | `axios` directly, or call a Next.js API route |
| Mutations (forms) | Next.js Server Actions (`'use server'`) |

Always prefer `serverApiFetch` in server components — it handles auth and redirects automatically.

### Forms & Server Actions

- Use HTML `<form action={serverAction}>` with `FormData`
- Show feedback via Sonner toasts (`import { toast } from 'sonner'`)
- Use the `SubmitButton` shared component for submission UI
- Return `ActionResult` from server actions

### Styling

- Tailwind CSS v4 utility-first; no CSS Modules
- Theme defined in `globals.css` using oklch() CSS custom properties (`--primary`, `--background`, etc.)
- Dark mode via `.dark` class: `@custom-variant dark (&:is(.dark *))`
- shadcn/ui components are the default for any new UI elements — check `components/ui/` before building from scratch
- Framer Motion / Motion for animations

---

## Adding New Features — Checklist

1. **Page?** Add under `app/(auth)/` or `app/dashboard/` as appropriate.
2. **API call?** Add a proxy route under `app/api/` if client-side, or call `serverApiFetch` directly in server components.
3. **New type?** Add to `src/types/`.
4. **New UI component?** Check `components/ui/` first. If it needs a new shadcn component, use `npx shadcn@latest add <component>`.
5. **Client component?** Add `'use client'` and keep state local; avoid prop drilling.
6. **Authentication required?** Use `serverApiFetch` — it redirects unauthenticated users automatically.
7. **Run `npm run lint` and `npm run format`** before committing.

---

## What Does Not Exist (Yet)

- **No test suite** — no Jest, Vitest, or Testing Library configured
- **No Storybook** — no component catalogue
- **No deployment config** — no Dockerfile, Vercel config, or deployment scripts committed

---

## Dependencies Quick Reference

| Package | Purpose |
|---|---|
| `next` | Framework (App Router) |
| `react` / `react-dom` | UI runtime |
| `axios` | HTTP client |
| `zod` | Schema validation |
| `sonner` | Toast notifications |
| `next-themes` | Dark/light theme switching |
| `framer-motion` / `motion` | Animations |
| `lucide-react` | Icons |
| `@heroicons/react` | Additional icons |
| `class-variance-authority` | Component variant styling |
| `clsx` + `tailwind-merge` | Conditional className merging (via `cn()`) |
| `@radix-ui/*` | Headless UI primitives used by shadcn/ui |
| `input-otp` | OTP input for verification flow |
| `lottie-react` | Lottie animation support |
