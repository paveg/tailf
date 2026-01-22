# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**tailf** is a Japanese developer blog aggregator. The name comes from `tail -f`, the Unix command for following file changes in real-time.

**Mission**: 日本の技術ブログを、もっと見つけやすく (Make Japanese tech blogs more discoverable)

## Commands

```bash
# Development (runs both API and Web concurrently)
pnpm dev

# Run individually
pnpm dev:web    # Astro dev server (port 4321)
pnpm dev:api    # Wrangler dev server (port 8788)

# Build
pnpm build           # Build web only
pnpm build:prod      # Run migrations + build (for CI/CD)

# Deploy
pnpm deploy          # Deploy API to Cloudflare Workers

# Database
pnpm db:generate         # Generate migration from schema changes
pnpm db:migrate:local    # Apply migrations to local D1
pnpm db:migrate:prod     # Apply migrations to production D1

# Lint & Format (Biome)
pnpm lint        # Check
pnpm lint:fix    # Fix
pnpm format      # Format

# Type check
pnpm typecheck

# Test
pnpm test        # Run all tests
```

## Architecture

```
tailf/
├── apps/
│   ├── api/              # Hono on Cloudflare Workers
│   │   ├── src/
│   │   │   ├── routes/       # API endpoints (REST, cursor-based)
│   │   │   ├── services/     # Business logic (RSS, Hatena, tech-score)
│   │   │   ├── middleware/   # Auth middleware
│   │   │   ├── db/           # Drizzle schema and connection
│   │   │   ├── utils/        # Cursor, pagination, date utilities
│   │   │   └── data/         # Static data (official feeds)
│   │   └── wrangler.toml     # Workers config
│   │
│   └── web/              # Astro + React (SSG)
│       └── src/
│           ├── pages/        # Astro pages (.astro files)
│           ├── components/   # React components (shadcn/ui)
│           ├── layouts/      # Layout templates
│           ├── lib/          # Hooks, API client, utilities
│           └── styles/       # global.css (design tokens)
│
├── packages/
│   └── shared/           # Shared types, schemas (Valibot)
│
└── docs/                 # Specifications and documentation
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Astro (SSG) + React + Tailwind CSS v4 + shadcn/ui |
| Backend | Hono + Drizzle ORM |
| Database | Cloudflare D1 (SQLite) |
| Auth | GitHub OAuth |
| AI | Cloudflare Workers AI (BGE-M3 embeddings) |
| Deploy | Cloudflare Workers + Workers Builds |

## Key Files

- `apps/api/src/db/schema.ts` - Database schema
- `apps/api/src/routes/*.ts` - API endpoints
- `apps/api/src/utils/pagination.ts` - Cursor-based pagination
- `apps/web/src/styles/global.css` - Design tokens (GitHub Primer)
- `apps/web/src/lib/hooks.ts` - React Query hooks
- `apps/web/src/lib/queryClient.ts` - Singleton QueryClient
- `packages/shared/src/schema/index.ts` - Shared Valibot schemas

## Core Conventions

### Language
- **UI Text**: Japanese
- **Code/Comments**: English
- **Commit Messages**: English (Conventional Commits)

### Code Style
- **Linter/Formatter**: Biome (not ESLint/Prettier)
- **CSS**: Tailwind v4 with CSS variables
- **Components**: shadcn/ui (no custom style overrides)

### Git
- Conventional commits: `feat:`, `fix:`, `perf:`, `refactor:`, `docs:`
- Co-Authored-By for Claude contributions

## Additional Rules

See `.claude/rules/` for detailed guidelines:
- `frontend.md` - UI/UX design philosophy
- `backend.md` - API design (Google AIP style)
- `common.md` - Shared conventions (DRY, monorepo)
