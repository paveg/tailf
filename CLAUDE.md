# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

tailf is a Japanese developer blog aggregator. The name comes from `tail -f`, the Unix command for following file changes in real-time.

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
```

## Architecture

```
tailf/
├── apps/
│   ├── api/          # Hono on Cloudflare Workers
│   │   ├── src/
│   │   │   ├── routes/     # API endpoints (auth, blogs, posts, feed)
│   │   │   ├── services/   # Business logic (rss.ts)
│   │   │   └── db/         # Drizzle schema and connection
│   │   └── wrangler.toml   # Workers config
│   │
│   └── web/          # Astro + React
│       └── src/
│           ├── pages/      # Astro pages (.astro files)
│           ├── components/ # React components (shadcn/ui)
│           ├── layouts/    # Layout templates
│           └── styles/     # global.css (design tokens)
│
├── packages/
│   └── shared/       # Shared types and utilities
│
└── docs/             # MVP spec and TODO
```

## Tech Stack

- **Frontend**: Astro (SSG) + React + Tailwind CSS v4 + shadcn/ui
- **Backend**: Hono + Drizzle ORM
- **Database**: Cloudflare D1 (SQLite)
- **Auth**: GitHub OAuth
- **Deploy**: Cloudflare Workers + Cloudflare Workers Builds (CI/CD)

## Key Files

- `apps/api/src/db/schema.ts` - Database schema (users, blogs, posts, follows, sessions)
- `apps/api/src/services/rss.ts` - RSS feed fetching logic
- `apps/web/src/styles/global.css` - Design tokens (GitHub Primer colors)
- `apps/web/src/layouts/Layout.astro` - Main layout with header/footer

## Conventions

- **Language**: Japanese for UI text, English for code/comments
- **Linter/Formatter**: Biome (not ESLint/Prettier)
- **CSS**: Tailwind v4 with CSS variables, no custom style overrides on shadcn/ui
- **Commits**: Conventional commits, Co-Authored-By for Claude
