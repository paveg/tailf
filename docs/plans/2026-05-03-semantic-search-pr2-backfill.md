# Semantic Search — PR #2 (Backfill) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two admin endpoints (`POST /api/admin/embeddings/backfill` and `GET /api/admin/embeddings/status`) plus an ops runbook so the ~5K historical posts that PR #1 left with `embedding IS NULL` can be batch-embedded incrementally.

**Architecture:** Append two routes to `apps/api/src/routes/admin.ts`. Backfill selects N posts where `embedding IS NULL`, runs a single `computeBatch` against Workers AI, encodes each vector via `encodeEmbedding`, then issues N `UPDATE` statements. Idempotent — re-running picks up where it stopped. Status endpoint is a single `SELECT count` query. No new files in `services/`; both endpoints reuse the embedding service shipped in PR #1.

**Tech Stack:** Hono on Cloudflare Workers, Drizzle ORM, D1 (SQLite), Workers AI (`@cf/baai/bge-m3` via `services/embedding.ts`).

**Reference spec:** `docs/design/2026-05-03-semantic-search.md` §5.3, §5.4, §10 (PR #2 row).

---

## Testing scope note

`apps/api/src/routes/admin.ts` has **no** existing unit tests (`admin.test.ts` does not exist), consistent with `routes/feeds.ts`. The repo's vitest runs in plain Node (not Workers pool) so persistence-side admin handlers cannot be exercised against a real D1.

What that means for this plan:

- **No new vitest tests for the route handlers themselves.** Verification is via local smoke test (Task 4) and post-merge production observation.
- The only pure logic worth unit-testing here is the existing `embedding.ts` (covered in PR #1).

## Subrequest budget

Workers Paid plan ceiling is 1000 subrequests/invocation. Backfill cost per call:

| Op | Count |
|----|-------|
| 1 SELECT (find NULL embeddings) | 1 |
| 1 SELECT count (for `remaining`) | 1 |
| `computeBatch` AI call | 1 |
| N UPDATEs (per post) | N |
| **Total** | **N + 3** |

With a max `batchSize = 200` (per spec §5.3), worst case is 203 subrequests — well under the 1000 ceiling. Default `batchSize = 100` (103 subrequests) is conservative.

D1 storage delta: 200 posts × 4096 bytes/post = 800 KB per batch. Backfilling all 5K rows = ~20 MB total over ~50 batches.

---

## Pre-flight

### Task 0: Branch and baseline

**Files:** none

- [ ] **Step 0.1: Confirm clean main**

```bash
cd /Users/ryota/repos/github.com/paveg/tailf
git fetch origin main
git log --oneline origin/main -3
```

Expected: top commit is `1416399 feat(api): persist BGE-M3 embeddings on post ingest (semantic search PR #1/3) (#48)` (or whatever PR #1's squash SHA was). If PR #1 isn't on `main` yet, STOP — PR #2 depends on the schema column and embedding service it added.

- [ ] **Step 0.2: Create implementation branch from main**

```bash
cd /Users/ryota/repos/github.com/paveg/tailf
git checkout main
git pull origin main
git checkout -b feat/semantic-search-pr2-backfill
```

- [ ] **Step 0.3: Confirm baseline tests**

```bash
pnpm --filter @tailf/api test
```

Expected: 369 passing, 18 files. (PR #1 added 6 tests on top of the 363 baseline.) If anything fails, STOP.

---

## Phase A — Status endpoint (start small)

### Task 1: `GET /api/admin/embeddings/status`

Adds a cheap progress query so an operator running backfill can see how far we've gotten without inspecting D1 directly.

**Files:**
- Modify: `apps/api/src/routes/admin.ts` (append new route)

- [ ] **Step 1.1: Add the import for `sql` from drizzle-orm**

At the top of `apps/api/src/routes/admin.ts`, find the line:

```typescript
import { and, eq, isNull } from 'drizzle-orm'
```

Change it to:

```typescript
import { and, eq, isNotNull, isNull, sql } from 'drizzle-orm'
```

(Both `sql` and `isNotNull` will be used — `sql` for the count expression, `isNotNull` for the WHERE clause in Task 2.)

- [ ] **Step 1.2: Append the status route**

Append at the end of `apps/api/src/routes/admin.ts` (after the closing of `/posts/rescore`):

```typescript
// GET /admin/embeddings/status - Progress of the embedding backfill
adminRoute.get('/embeddings/status', async (c) => {
	const db = c.get('db')

	const rows = await db
		.select({
			total: sql<number>`COUNT(*)`,
			withEmbedding: sql<number>`SUM(CASE WHEN embedding IS NOT NULL THEN 1 ELSE 0 END)`,
		})
		.from(posts)

	const total = Number(rows[0]?.total ?? 0)
	const withEmbedding = Number(rows[0]?.withEmbedding ?? 0)
	const percent = total === 0 ? 100 : Math.round((withEmbedding / total) * 1000) / 10

	return c.json({
		data: { total, withEmbedding, percent },
	})
})
```

Notes:
- `Number(...)` coercion: D1 returns SUM/COUNT as either `number` or `bigint` depending on the driver; coercing here keeps the JSON output predictable.
- `Math.round(... * 1000) / 10` gives one decimal place (e.g. `42.7`).
- Empty table → `percent: 100` (vacuously complete).

- [ ] **Step 1.3: Run tests for regression**

```bash
pnpm --filter @tailf/api test
```

Expected: 369 passing. (Adding a new route shouldn't affect any existing tests.)

- [ ] **Step 1.4: Per-file typecheck for admin.ts**

```bash
pnpm --filter @tailf/api exec tsc --noEmit --skipLibCheck src/routes/admin.ts
```

Expected: same set of pre-existing infrastructure errors (Workers ambient types, etc.). No new errors. If you see anything that mentions `embedding`, `sql`, `isNotNull`, or the new route — investigate and report.

- [ ] **Step 1.5: Commit**

```bash
git add apps/api/src/routes/admin.ts
git commit -m "feat(admin): add embeddings status endpoint

GET /api/admin/embeddings/status returns {total, withEmbedding, percent}
for monitoring backfill progress.

Refs docs/design/2026-05-03-semantic-search.md §5.4

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase B — Backfill endpoint

### Task 2: `POST /api/admin/embeddings/backfill`

Selects up to `batchSize` posts with `embedding IS NULL`, runs a single batched embedding call, and writes each vector back. Idempotent — running again picks up the next batch.

**Files:**
- Modify: `apps/api/src/routes/admin.ts` (append new route + add imports)

- [ ] **Step 2.1: Add imports**

Find the top of `apps/api/src/routes/admin.ts`. After the existing service imports (around lines 9-14), add:

```typescript
import { computeBatch, encodeEmbedding } from '../services/embedding'
```

- [ ] **Step 2.2: Append the backfill route**

Append at the end of `apps/api/src/routes/admin.ts` (after the status route from Task 1):

```typescript
// POST /admin/embeddings/backfill - Compute embeddings for posts that don't have one yet
// Body: { batchSize?: number }   default 100, hard cap 200 (subrequest budget)
//
// Idempotent: re-running selects the next batch of NULL-embedding posts.
// Returns { processed, remaining, durationMs, done }.
adminRoute.post('/embeddings/backfill', async (c) => {
	const db = c.get('db')
	const ai = c.env.AI
	if (!ai) {
		return c.json({ error: 'AI binding not available' }, 503)
	}

	const DEFAULT_BATCH = 100
	const MAX_BATCH = 200

	const body = await c.req.json<{ batchSize?: number }>().catch(() => ({}))
	const batchSize = Math.min(
		Math.max(1, Number.isFinite(body.batchSize) ? Number(body.batchSize) : DEFAULT_BATCH),
		MAX_BATCH,
	)

	const start = Date.now()

	const candidates = await db.query.posts.findMany({
		where: isNull(posts.embedding),
		columns: { id: true, title: true, summary: true },
		orderBy: (p, { desc }) => desc(p.publishedAt),
		limit: batchSize,
	})

	if (candidates.length === 0) {
		return c.json({
			data: { processed: 0, remaining: 0, durationMs: Date.now() - start, done: true },
		})
	}

	const texts = candidates.map((p) => `${p.title} ${p.summary ?? ''}`)

	let processed = 0
	const errors: string[] = []
	try {
		const vectors = await computeBatch(ai, texts)
		for (let i = 0; i < candidates.length; i++) {
			try {
				const blob = encodeEmbedding(vectors[i])
				await db.update(posts).set({ embedding: blob }).where(eq(posts.id, candidates[i].id))
				processed++
			} catch (e) {
				errors.push(`${candidates[i].id}: ${e}`)
			}
		}
	} catch (e) {
		return c.json({ error: 'computeBatch failed', details: String(e) }, 500)
	}

	const remainingRows = await db
		.select({ remaining: sql<number>`COUNT(*)` })
		.from(posts)
		.where(isNull(posts.embedding))
	const remaining = Number(remainingRows[0]?.remaining ?? 0)

	return c.json({
		data: {
			processed,
			remaining,
			durationMs: Date.now() - start,
			done: remaining === 0,
		},
		errors: errors.length > 0 ? errors : undefined,
	})
})
```

Notes for the implementer:
- The per-post `try/catch` around `encodeEmbedding` + `UPDATE` means a single malformed vector (the kind PR #1's encode guard now rejects) only skips one post — the rest of the batch still lands.
- The outer `try/catch` around `computeBatch` returns a 500 (so the operator script can decide to retry) but only if the AI call itself fails.
- `orderBy desc(publishedAt)` means newest unembedded posts get filled first — the most likely to be relevant in a search.
- `data` envelope matches the project's existing admin route response shape (see `/posts/rescore`).

- [ ] **Step 2.3: Verify the file still typechecks**

```bash
cd /Users/ryota/repos/github.com/paveg/tailf
pnpm --filter @tailf/api exec tsc --noEmit --skipLibCheck src/routes/admin.ts
```

Expected: only the pre-existing infrastructure errors. No new errors that mention `computeBatch`, `encodeEmbedding`, `vectors`, etc.

- [ ] **Step 2.4: Run full test suite**

```bash
pnpm --filter @tailf/api test
```

Expected: 369 passing. Unchanged.

- [ ] **Step 2.5: Commit**

```bash
git add apps/api/src/routes/admin.ts
git commit -m "feat(admin): add embeddings backfill endpoint

POST /api/admin/embeddings/backfill takes an optional batchSize
(default 100, max 200), embeds the next batch of posts where
embedding IS NULL, and reports progress. Idempotent — operator
loops until done=true.

Encodes each vector inside its own try/catch so a single malformed
embedding cannot poison the whole batch.

Refs docs/design/2026-05-03-semantic-search.md §5.3

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase C — Local smoke test

### Task 3: Verify both endpoints against local D1

Pure verification step. Confirms the two endpoints return the right shape and that the backfill actually persists 4096-byte BLOBs.

**Files:** none (no commit)

- [ ] **Step 3.1: Start the dev server in the worktree**

```bash
cd /Users/ryota/repos/github.com/paveg/tailf
nohup pnpm dev:api > /tmp/tailf-api-dev-pr2.log 2>&1 &
echo "PID: $!"
sleep 8  # let wrangler boot
```

(If `apps/web/dist` is missing and wrangler complains, run `mkdir -p apps/web/dist` and restart.)

- [ ] **Step 3.2: Check the status endpoint with no auth**

```bash
curl -sS -i http://localhost:8788/api/admin/embeddings/status
```

Expected: HTTP 401 with body `{"error":"Unauthorized"}`. Confirms admin auth still gates the route.

- [ ] **Step 3.3: Check status with auth**

You need an `ADMIN_SECRET` configured. The dev `.dev.vars` should have one. If not:

```bash
cd /Users/ryota/repos/github.com/paveg/tailf/apps/api
# Read whatever ADMIN_SECRET is set to, OR create one if .dev.vars doesn't exist:
grep ADMIN_SECRET .dev.vars 2>/dev/null || echo 'ADMIN_SECRET=local-dev-secret' >> .dev.vars
# Restart dev server to pick up the new var (kill + relaunch from Step 3.1)
```

Then:

```bash
ADMIN_SECRET=$(grep ADMIN_SECRET /Users/ryota/repos/github.com/paveg/tailf/apps/api/.dev.vars | cut -d= -f2)
curl -sS -H "Authorization: Bearer $ADMIN_SECRET" http://localhost:8788/api/admin/embeddings/status
```

Expected: JSON with `{"data":{"total":<N>,"withEmbedding":<M>,"percent":<P>}}`. `total` should be > 0 (you ran the cron in PR #1's smoke test). `withEmbedding` may be > 0 if your local D1 carried over from PR #1's smoke run.

If you want to start from a clean slate so backfill has work to do:

```bash
cd /Users/ryota/repos/github.com/paveg/tailf/apps/api
pnpm wrangler d1 execute tailf-db --local --command "UPDATE posts SET embedding = NULL;"
```

(Local-only operation; safe.)

- [ ] **Step 3.4: Run the backfill endpoint**

```bash
curl -sS -X POST -H "Authorization: Bearer $ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"batchSize": 50}' \
  http://localhost:8788/api/admin/embeddings/backfill
```

Expected: JSON like `{"data":{"processed":50,"remaining":<N-50>,"durationMs":<ms>,"done":false}}`. `processed` should equal `batchSize` (or fewer if the backlog is smaller). `durationMs` ought to be in the low-thousands range for batchSize 50 (one AI call + 50 UPDATEs).

- [ ] **Step 3.5: Verify a BLOB landed**

```bash
cd /Users/ryota/repos/github.com/paveg/tailf/apps/api
pnpm wrangler d1 execute tailf-db --local --command "SELECT id, length(embedding) AS bytes FROM posts WHERE embedding IS NOT NULL ORDER BY created_at DESC LIMIT 3;"
```

Expected: each row shows `bytes = 4096`.

- [ ] **Step 3.6: Run status again to confirm progress**

```bash
curl -sS -H "Authorization: Bearer $ADMIN_SECRET" http://localhost:8788/api/admin/embeddings/status
```

Expected: `withEmbedding` increased by `processed` from the previous call; `percent` increased proportionally.

- [ ] **Step 3.7: Loop until `done: true`**

Optional but worth doing once locally so you've seen the full flow:

```bash
while true; do
  RESP=$(curl -sS -X POST -H "Authorization: Bearer $ADMIN_SECRET" \
    -H "Content-Type: application/json" \
    -d '{"batchSize": 100}' \
    http://localhost:8788/api/admin/embeddings/backfill)
  echo "$RESP"
  echo "$RESP" | grep -q '"done":true' && break
  sleep 1
done
```

Expected: a series of responses with `processed > 0` and decreasing `remaining`, ending with `{"data":{"processed":0,"remaining":0,"durationMs":...,"done":true}}` (or the final non-empty batch followed by a done call).

- [ ] **Step 3.8: Stop the dev server**

```bash
pkill -f "wrangler dev" || true
```

---

## Phase D — Operations runbook

### Task 4: Write the production runbook

**Files:**
- Create: `docs/runbook/embeddings-backfill.md`

- [ ] **Step 4.1: Create the runbook file**

```bash
cd /Users/ryota/repos/github.com/paveg/tailf
mkdir -p docs/runbook
```

- [ ] **Step 4.2: Write the runbook**

Write `docs/runbook/embeddings-backfill.md` with **exactly** this content:

````markdown
# Embeddings Backfill Runbook

After PR #2 ships, the production database has the `posts.embedding` column populated only for posts inserted *after* PR #1's deploy. This runbook covers backfilling the historical rows.

## When to run

- Once, immediately after PR #2 reaches production.
- Re-run if a new bulk-import (e.g. mass feed registration) leaves a wedge of NULL-embedding rows.

## Pre-flight

Confirm the endpoints are live:

```sh
curl -sS -H "Authorization: Bearer $ADMIN_SECRET" \
  https://tailf.pavegy.workers.dev/api/admin/embeddings/status
```

Expected: `{"data":{"total":N,"withEmbedding":M,"percent":P}}` where `M < N`.

## Run

Loop until `done: true`. Default batch size (100) is the right starting point; bump to 200 if you want to finish faster.

```sh
ADMIN_SECRET=$(op read 'op://tailf/admin-secret/password')   # or wherever you store it
HOST=https://tailf.pavegy.workers.dev

while true; do
  RESP=$(curl -sS -X POST \
    -H "Authorization: Bearer $ADMIN_SECRET" \
    -H "Content-Type: application/json" \
    -d '{"batchSize": 100}' \
    "$HOST/api/admin/embeddings/backfill")
  echo "$(date -u +%H:%M:%S) $RESP"
  echo "$RESP" | grep -q '"done":true' && break
  sleep 2
done
```

Expected wall time for ~5K posts at batchSize 100: ~50 batches × 3-5 s each = **3-5 minutes**.

## During the run

- Each call costs ~N + 3 subrequests. Workers Paid ceiling is 1000 — well under.
- BGE-M3 is billed per input tokens. ~5K posts × ~250 tokens average = ~1.25M tokens, roughly $0.015 total.
- D1 grows by ~20 MB (5K × 4096 bytes).

## After the run

```sh
curl -sS -H "Authorization: Bearer $ADMIN_SECRET" \
  "$HOST/api/admin/embeddings/status"
```

Expected: `withEmbedding == total`, `percent == 100`. If not, run the loop again — idempotent.

## Failure modes

| Symptom | Likely cause | Action |
|---------|--------------|--------|
| HTTP 503 `AI binding not available` | Workers AI binding not configured for the deployed Worker | Check `wrangler.toml` and the Cloudflare dashboard's Worker bindings |
| HTTP 500 `computeBatch failed` | Workers AI rate-limited or model timeout | Wait 60 s, retry. The operation is idempotent — partial progress is preserved. |
| `errors[]` array in response | One or more individual posts hit `encodeEmbedding` length guard or D1 UPDATE failure | Investigate the listed post IDs. Re-running the backfill skips already-embedded posts and retries the failed ones. |
| `processed: 0, done: false` | Should not happen. Means the SELECT returned zero candidates but the COUNT > 0. | Possibly a transactional-isolation oddity. Wait 5 s and retry. |

## Stopping early

The endpoint is stateless. Killing the loop mid-run leaves the DB in a consistent state — already-embedded posts stay embedded, the rest stay NULL. Resume with the same loop.
````

- [ ] **Step 4.3: Commit**

```bash
git add docs/runbook/embeddings-backfill.md
git commit -m "docs(runbook): add embeddings backfill runbook

Operational playbook for running POST /api/admin/embeddings/backfill
against production after PR #2 ships.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase E — End-to-end verification

### Task 5: Aggregate checks

**Files:** none

- [ ] **Step 5.1: Tests**

```bash
cd /Users/ryota/repos/github.com/paveg/tailf
pnpm --filter @tailf/api test
```

Expected: 369 passing.

- [ ] **Step 5.2: Lint**

```bash
pnpm lint
```

Expected: clean. (If running from a worktree under `.claude/`, biome may report "No files were processed" — same quirk as PR #1; falls back to `pnpm --filter @tailf/api exec biome check src/routes/admin.ts` to verify.)

- [ ] **Step 5.3: Per-file typecheck**

```bash
pnpm --filter @tailf/api exec tsc --noEmit --skipLibCheck src/routes/admin.ts
```

Expected: only pre-existing infrastructure errors.

---

## Phase F — Pull request

### Task 6: Open PR #2

**Files:** none

- [ ] **Step 6.1: Push the branch**

```bash
cd /Users/ryota/repos/github.com/paveg/tailf
git push -u origin feat/semantic-search-pr2-backfill
```

- [ ] **Step 6.2: Confirm with the user before opening the PR**

Per `~/.claude/rules/workflow.md` — "Push and PR creation require explicit user confirmation." STOP and wait.

- [ ] **Step 6.3: Create PR (only after user confirms)**

```bash
cd /Users/ryota/repos/github.com/paveg/tailf
cat > /tmp/pr2_body.md <<'EOF'
## Summary

Second of three PRs that ship semantic search. This PR adds the operator tools for backfilling the ~5K historical posts that PR #1 left with `embedding IS NULL`. **No user-visible change.**

- `POST /api/admin/embeddings/backfill` — selects up to `batchSize` posts (default 100, max 200) where `embedding IS NULL`, runs a single batched BGE-M3 call, persists each L2-normalized vector via `encodeEmbedding`. Idempotent.
- `GET /api/admin/embeddings/status` — single-query progress: `{total, withEmbedding, percent}`.
- `docs/runbook/embeddings-backfill.md` — playbook for the post-merge ops loop.

## Why now

PR #1 added the schema column and started persisting embeddings on **new** posts. Historical rows are all NULL. PR #3 (search cutover) requires those rows to have vectors or it falls back to FTS5 for them — which would feel like a half-broken search to users. This PR closes that gap before PR #3 lands.

## Cost

- Workers AI: ~5K posts × ~250 tokens ≈ 1.25M input tokens = **~$0.015 one-time** at BGE-M3 rates.
- D1 storage delta: 5K × 4096 bytes = **~20 MB** added.
- Subrequest budget per call: N + 3 (1 SELECT, 1 AI batch, N UPDATEs, 1 count) — at max batchSize 200 = 203, well under the 1000/invocation Paid-plan ceiling.

## Test plan

- [x] `pnpm --filter @tailf/api test` — 369/369 (no test count change; the route handlers don't have unit-test infra in this repo, consistent with `routes/feeds.ts`).
- [x] Local D1 smoke: status endpoint returns expected shape with auth + 401 without; backfill endpoint actually populates 4096-byte BLOBs and walks `remaining` to zero.
- [ ] After merge: run the runbook against production. Expected wall time ~3-5 min for the historical 5K rows.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF

gh pr create --base main \
  --title "feat(admin): backfill historical embeddings (semantic search PR #2/3)" \
  --body-file /tmp/pr2_body.md
```

(Body is written to a file because this PR body has nested code fences; per `gh-pr-body.md` global rule, file-based body avoids backslash-escape pitfalls.)

- [ ] **Step 6.4: Verify the PR body rendered correctly**

```bash
PR_NUM=$(gh pr list --repo paveg/tailf --head feat/semantic-search-pr2-backfill --json number -q '.[0].number')
gh pr view "$PR_NUM" --repo paveg/tailf --json body -q '.body' | awk '/^\\`/ {print NR": "$0}'
```

Expected: empty output (no lines starting with backslash-backtick). If anything prints, the body has broken code fences — re-edit with `gh pr edit "$PR_NUM" --body-file /tmp/pr2_body.md` after fixing the source file.

---

## Out of scope (PR #3)

- Replacing `/api/posts/search` with vector ranking
- `mode: 'semantic' | 'keyword'` field in search response
- `SearchInput` placeholder + caption changes

PR #3 plan is written separately after PR #2 lands.
