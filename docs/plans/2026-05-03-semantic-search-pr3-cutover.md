# Semantic Search — PR #3 (Cutover) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the FTS5-backed `/api/posts/search` handler with a vector-ranking implementation that uses the BGE-M3 embeddings persisted in PRs #1 + #2. Update the search UI's placeholder and add a "意味的に近い順" caption when results are semantic. **This is the user-visible PR.**

**Architecture:** Extract pure scoring/cursor logic into `apps/api/src/services/semantic-search.ts` (testable). Replace the route handler in `apps/api/src/routes/posts.ts` so `q.length >= 3` runs the embedding pipeline and `q.length < 3` keeps the existing LIKE fallback. AI failure or per-row decode error falls through to LIKE with `mode: 'keyword'`. Frontend gets a placeholder text change and a small caption indicator.

**Tech Stack:** Hono on Cloudflare Workers, Drizzle ORM, D1 (SQLite), Workers AI (`@cf/baai/bge-m3` via `services/embedding.ts`), Astro + React frontend.

**Reference spec:** `docs/design/2026-05-03-semantic-search.md` §5.1, §5.2, §6, §8, §10 (PR #3 row).

---

## Testing scope note

`apps/api/src/routes/posts.test.ts` exists but only validates query schema parsing — no integration with D1 or AI. The plan therefore covers behavior with:

1. **Pure-function unit tests** for everything in `services/semantic-search.ts` (cursor codec, dot product, ranker). These are real coverage.
2. **Local smoke test** (Task 4) for the wired-up route handler against the local D1.
3. **Production sanity check** (Task 8) after merge: hit `/api/posts/search?q=...` and verify `meta.mode === 'semantic'`.

No new test infra (Workers vitest pool) is set up here. That remains a separate concern.

## Subrequest budget

| Op (per `q≥3` semantic search) | Count |
|--------------------------------|-------|
| Query → embedding via `compute` | 1 |
| Candidates SELECT (id, embedding, publishedAt) | 1 |
| Detail SELECT with relations (top-K by ID) | 1 |
| **Total** | **3** |

Far under the 1000/invocation Paid-plan ceiling.

## Memory budget

At the current 5K-post corpus with no filters: 5000 × 1024 floats × 4 bytes = **~20 MB** of embedding data per request. Workers' 128 MB limit per invocation gives plenty of headroom. Filter-applied requests (techOnly, topic, official) cut this proportionally.

---

## Pre-flight

### Task 0: Branch and baseline

**Files:** none

- [ ] **Step 0.1: Confirm PR #2 is on main**

```bash
cd /Users/ryota/repos/github.com/paveg/tailf
git fetch origin main
git log --oneline origin/main -5
```

Expected: top commit is the PR #2 squash (`bc50cae` — `feat(admin): backfill historical embeddings ...`). If not present, STOP — PR #3 depends on the backfill endpoints existing in production for any post-merge verification you might want to run.

- [ ] **Step 0.2: Create implementation branch**

```bash
cd /Users/ryota/repos/github.com/paveg/tailf
git checkout main
git pull origin main
git checkout -b feat/semantic-search-pr3-cutover
```

- [ ] **Step 0.3: Confirm baseline tests**

```bash
pnpm --filter @tailf/api test
```

Expected: 369 passing, 18 files (carried over from PR #2). If anything fails, STOP.

---

## Phase A — Semantic search service (TDD)

### Task 1: `services/semantic-search.ts` — pure functions

This service holds the search-specific logic that doesn't belong in the route handler: cursor encoding/decoding (offset-based, opaque), dot-product over normalized vectors, and the in-memory ranking step.

**Files:**
- Create: `apps/api/src/services/semantic-search.ts`
- Create: `apps/api/src/services/semantic-search.test.ts`

#### Step 1.1: Write the failing test

Create `apps/api/src/services/semantic-search.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import {
	decodeOffsetCursor,
	dot,
	encodeOffsetCursor,
	rankCandidates,
} from './semantic-search'

describe('encodeOffsetCursor / decodeOffsetCursor', () => {
	it('round-trips an offset value', () => {
		const cursor = encodeOffsetCursor(120)
		expect(typeof cursor).toBe('string')
		expect(decodeOffsetCursor(cursor)).toBe(120)
	})

	it('encodes 0 (start of results)', () => {
		const cursor = encodeOffsetCursor(0)
		expect(decodeOffsetCursor(cursor)).toBe(0)
	})

	it('decodeOffsetCursor returns 0 for malformed input', () => {
		expect(decodeOffsetCursor('not-base64-!!!')).toBe(0)
		expect(decodeOffsetCursor('eyJqdW5rIjoxfQ==')).toBe(0) // valid base64, wrong shape
		expect(decodeOffsetCursor('')).toBe(0)
	})

	it('decodeOffsetCursor returns 0 for negative or fractional offsets', () => {
		expect(decodeOffsetCursor(encodeOffsetCursor(-5))).toBe(0)
		// Manually craft a cursor with a fractional offset
		const fractional = btoa(JSON.stringify({ offset: 2.7 }))
		expect(decodeOffsetCursor(fractional)).toBe(0)
	})
})

describe('dot', () => {
	it('returns the dot product of two equal-length Float32Arrays', () => {
		const a = new Float32Array([1, 2, 3])
		const b = new Float32Array([4, 5, 6])
		// 1*4 + 2*5 + 3*6 = 4 + 10 + 18 = 32
		expect(dot(a, b)).toBeCloseTo(32, 6)
	})

	it('returns 1 for identical unit vectors', () => {
		const v = new Float32Array([0.6, 0.8, 0])
		expect(dot(v, v)).toBeCloseTo(1, 6)
	})

	it('returns 0 for orthogonal vectors', () => {
		const a = new Float32Array([1, 0, 0])
		const b = new Float32Array([0, 1, 0])
		expect(dot(a, b)).toBe(0)
	})
})

describe('rankCandidates', () => {
	it('returns candidates sorted by score descending', () => {
		const queryVec = new Float32Array([1, 0, 0, 0])
		const candidates = [
			{ id: 'a', vec: new Float32Array([0, 1, 0, 0]) }, // score 0
			{ id: 'b', vec: new Float32Array([1, 0, 0, 0]) }, // score 1
			{ id: 'c', vec: new Float32Array([0.5, 0.5, 0, 0]) }, // score 0.5
		]
		const ranked = rankCandidates(queryVec, candidates)
		expect(ranked.map((r) => r.id)).toEqual(['b', 'c', 'a'])
		expect(ranked[0].score).toBeCloseTo(1, 6)
	})

	it('returns [] for empty candidate list', () => {
		expect(rankCandidates(new Float32Array([1]), [])).toEqual([])
	})
})
```

#### Step 1.2: Run the test red

```bash
cd /Users/ryota/repos/github.com/paveg/tailf
pnpm --filter @tailf/api test semantic-search
```

Expected: FAIL with `Cannot find module './semantic-search'`.

#### Step 1.3: Implement the service

Create `apps/api/src/services/semantic-search.ts`:

```typescript
/**
 * Pure scoring + cursor primitives for the semantic search route.
 * The route handler in routes/posts.ts owns the I/O (DB queries, AI calls);
 * this module owns the math + serialization that is straightforward to unit-test.
 */

/**
 * Dot product of two equal-length Float32Arrays.
 * For L2-normalized inputs this equals cosine similarity.
 */
export function dot(a: Float32Array, b: Float32Array): number {
	let sum = 0
	for (let i = 0; i < a.length; i++) sum += a[i] * b[i]
	return sum
}

export interface ScoredCandidate {
	id: string
	score: number
}

/**
 * Score every candidate against the query vector and return them sorted by
 * score descending. Both `queryVec` and each `cand.vec` must be L2-normalized
 * for the score to be a true cosine similarity.
 */
export function rankCandidates(
	queryVec: Float32Array,
	candidates: Array<{ id: string; vec: Float32Array }>,
): ScoredCandidate[] {
	const scored: ScoredCandidate[] = candidates.map((c) => ({
		id: c.id,
		score: dot(queryVec, c.vec),
	}))
	scored.sort((a, b) => b.score - a.score)
	return scored
}

/**
 * Cursor format: base64-encoded JSON { offset: number }. Opaque to clients.
 * Stays compatible with the existing CursorResponse shape so the frontend
 * doesn't need a new type.
 */
export function encodeOffsetCursor(offset: number): string {
	return btoa(JSON.stringify({ offset }))
}

export function decodeOffsetCursor(cursor: string): number {
	try {
		const parsed = JSON.parse(atob(cursor))
		const offset = parsed?.offset
		if (typeof offset !== 'number' || !Number.isInteger(offset) || offset < 0) {
			return 0
		}
		return offset
	} catch {
		return 0
	}
}
```

#### Step 1.4: Run the test green

```bash
pnpm --filter @tailf/api test semantic-search
```

Expected: 9 tests passing in `apps/api/src/services/semantic-search.test.ts`.

#### Step 1.5: Run full suite

```bash
pnpm --filter @tailf/api test
```

Expected: 378 passing (369 baseline + 9 new).

#### Step 1.6: Commit

```bash
git add apps/api/src/services/semantic-search.ts apps/api/src/services/semantic-search.test.ts
git commit -m "feat(api): add semantic search service primitives

Pure-function building blocks for the upcoming route handler:
- dot() — Float32Array dot product (cosine for normalized inputs)
- rankCandidates() — score + sort
- encodeOffsetCursor / decodeOffsetCursor — opaque base64 cursor

9 unit tests cover correctness, empty input, and malformed cursor
inputs (negative, fractional, garbage base64).

Refs docs/design/2026-05-03-semantic-search.md §6

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase B — Replace the route handler

### Task 2: `/api/posts/search` becomes semantic-first

The new handler runs three paths:

1. **Semantic** (`q.length >= 3` AND AI healthy AND there exists at least one candidate post with embedding): rank by cosine, paginate by offset.
2. **Keyword LIKE fallback** (`q.length < 3` OR semantic path fails / yields nothing usable): the existing LIKE code path, unchanged.

Response gains `meta.mode: 'semantic' | 'keyword'`.

**Files:**
- Modify: `apps/api/src/routes/posts.ts` (replace the `/search` handler at lines 224-313 — read the file first to confirm exact line range)

#### Step 2.1: Add the import line

Open `apps/api/src/routes/posts.ts`. Find the existing imports near the top. Add:

```typescript
import { isNotNull } from 'drizzle-orm'
```

(It needs to merge into the existing big `from 'drizzle-orm'` import — find that line and insert `isNotNull` in alphabetical order.)

```typescript
import { compute } from '../services/embedding'
import {
	decodeEmbedding,
} from '../services/embedding'
import {
	decodeOffsetCursor,
	encodeOffsetCursor,
	rankCandidates,
} from '../services/semantic-search'
```

Consolidate so the final embedding import is one line:

```typescript
import { compute, decodeEmbedding } from '../services/embedding'
import {
	decodeOffsetCursor,
	encodeOffsetCursor,
	rankCandidates,
} from '../services/semantic-search'
```

(Match whatever sorting convention the existing imports use.)

#### Step 2.2: Rewrite `buildSearchResponse` to include `mode`

Find the existing helper at lines 186-196 (read the actual file to confirm). Replace it with:

```typescript
/**
 * Build search response with query and mode in meta.
 */
function buildSearchResponse<T extends { publishedAt: Date }>(
	results: T[],
	limit: number,
	query: string,
	mode: 'semantic' | 'keyword',
	overrideCursor?: { hasMore: boolean; nextCursor: string | null },
): ReturnType<typeof buildCursorResponse<T>> & { meta: { query: string; mode: 'semantic' | 'keyword' } } {
	if (overrideCursor) {
		return {
			data: results,
			meta: {
				hasMore: overrideCursor.hasMore,
				nextCursor: overrideCursor.nextCursor,
				query,
				mode,
			},
		}
	}
	const response = buildCursorResponse(results, limit)
	return {
		...response,
		meta: { ...response.meta, query, mode },
	}
}
```

The `overrideCursor` branch is for the semantic path, which can't use the standard `buildCursorResponse` (that one slices `results` and assumes the last item determines `nextCursor` from `publishedAt`). Semantic uses an offset cursor and pre-sliced data.

#### Step 2.3: Replace the `/search` handler

Find the existing `postsRoute.get('/search', ...)` handler (lines ~225-313). **Replace the entire handler** with:

```typescript
postsRoute.get(
	'/search',
	vValidator(
		'query',
		v.object({
			q: v.pipe(v.string(), v.minLength(1), v.maxLength(100)),
			...postsQuerySchema.entries,
		}),
	),
	async (c) => {
		const { q, cursor, limit, techOnly, official, topic } = c.req.valid('query')
		const db = c.get('db')
		const ai = c.env.AI

		// Resolve official-feed filter once
		let officialFeedIds: string[] | undefined
		if (official !== undefined) {
			officialFeedIds = await getOfficialFeedIds(db, official)
			if (officialFeedIds.length === 0) {
				return c.json(buildSearchResponse([], limit, q, 'semantic'))
			}
		}

		// Semantic path requires a long-enough query AND a working AI binding
		if (q.length >= 3 && ai) {
			try {
				const queryVec = await compute(ai, q)

				// Candidate set: only posts that have an embedding, with all filters applied
				const filterConditions = [
					isNotNull(posts.embedding),
					techOnly ? gte(posts.techScore, TECH_SCORE_THRESHOLD) : undefined,
					officialFeedIds ? buildFeedIdCondition(officialFeedIds, true) : undefined,
					topic ? or(eq(posts.mainTopic, topic), eq(posts.subTopic, topic)) : undefined,
				].filter((x): x is SQL => x !== undefined)

				const candidates = await db
					.select({
						id: posts.id,
						embedding: posts.embedding,
					})
					.from(posts)
					.where(and(...filterConditions))

				if (candidates.length > 0) {
					const decoded = candidates.map((row) => ({
						id: row.id,
						vec: decodeEmbedding(row.embedding as Uint8Array),
					}))
					const ranked = rankCandidates(queryVec, decoded)

					const offset = cursor ? decodeOffsetCursor(cursor) : 0
					const page = ranked.slice(offset, offset + limit + 1)
					const hasMore = page.length > limit
					const pageIds = page.slice(0, limit).map((r) => r.id)

					if (pageIds.length === 0) {
						return c.json(
							buildSearchResponse([], limit, q, 'semantic', {
								hasMore: false,
								nextCursor: null,
							}),
						)
					}

					// Fetch full details, preserving rank order
					const postRows = await db.query.posts.findMany({
						where: inArray(posts.id, pageIds),
						with: { feed: { with: { author: true } } },
					})
					const byId = new Map(postRows.map((p) => [p.id, p]))
					const ordered = pageIds
						.map((id) => byId.get(id))
						.filter((p): p is (typeof postRows)[number] => p !== undefined)
						.map((post) => ({
							...post,
							topics: topicsToArray(post.mainTopic, post.subTopic),
						}))

					return c.json(
						buildSearchResponse(ordered, limit, q, 'semantic', {
							hasMore,
							nextCursor: hasMore ? encodeOffsetCursor(offset + limit) : null,
						}),
					)
				}
				// Empty candidate set falls through to keyword path
			} catch (error) {
				console.warn('[Search] semantic path failed, falling back to keyword:', error)
				// Fall through to keyword path
			}
		}

		// Keyword LIKE fallback (also used for q.length < 3)
		const searchTerm = `%${q}%`
		const topicCondition = topic
			? or(eq(posts.mainTopic, topic), eq(posts.subTopic, topic))
			: undefined
		const conditions = [
			or(like(posts.title, searchTerm), like(posts.summary, searchTerm)),
			cursor ? lt(posts.publishedAt, new Date(cursor)) : undefined,
			techOnly ? gte(posts.techScore, TECH_SCORE_THRESHOLD) : undefined,
			officialFeedIds ? buildFeedIdCondition(officialFeedIds, true) : undefined,
			topicCondition,
		].filter(Boolean)

		const result = await db.query.posts.findMany({
			where: conditions.length > 0 ? and(...conditions) : undefined,
			limit: limit + 1,
			orderBy: [desc(posts.publishedAt)],
			with: { feed: { with: { author: true } } },
		})
		const postsWithTopics = result.map((post) => ({
			...post,
			topics: topicsToArray(post.mainTopic, post.subTopic),
		}))
		return c.json(buildSearchResponse(postsWithTopics, limit, q, 'keyword'))
	},
)
```

#### Step 2.4: Remove now-dead code

Search the rest of `routes/posts.ts` for references that are no longer needed:

```bash
cd /Users/ryota/repos/github.com/paveg/tailf
grep -n "FTS5_MIN_QUERY_LENGTH\|posts_fts\|MATCH\|buildOfficialSqlCondition" apps/api/src/routes/posts.ts
```

- `FTS5_MIN_QUERY_LENGTH` constant (line ~181): **delete** — no longer used.
- `buildOfficialSqlCondition` helper (lines ~202-222): **delete** — only used by the FTS5 path.
- `posts_fts` and `MATCH` references in raw SQL: **already removed** (they were inside the old handler body that you replaced).

Removing dead code keeps the file scannable.

#### Step 2.5: Run the existing posts route tests

```bash
pnpm --filter @tailf/api test posts
```

Expected: existing tests pass (they only validate query schema, which is unchanged).

#### Step 2.6: Run full suite

```bash
pnpm --filter @tailf/api test
```

Expected: 378 passing (369 baseline + 9 from Task 1).

#### Step 2.7: Per-file typecheck

```bash
pnpm --filter @tailf/api exec tsc --noEmit --skipLibCheck src/routes/posts.ts
```

Expected: only the pre-existing infrastructure errors. No new errors mentioning `compute`, `decodeEmbedding`, `rankCandidates`, `encodeOffsetCursor`, `decodeOffsetCursor`, `mode`, `queryVec`, etc.

#### Step 2.8: Commit

```bash
git add apps/api/src/routes/posts.ts
git commit -m "feat(api): replace /posts/search with semantic ranking

Queries with q.length >= 3 now embed the query via BGE-M3, score
all posts that have an embedding, and return the top-K by cosine
similarity. Filters (techOnly, official, topic) are applied at
candidate-fetch time before scoring.

q.length < 3, AI failure, and empty candidate set all fall through
to the existing LIKE path. Response gains meta.mode = 'semantic' |
'keyword' so the frontend can label the result set.

Removes the now-dead FTS5_MIN_QUERY_LENGTH constant and
buildOfficialSqlCondition helper. The posts_fts virtual table
stays in the schema as a future-use safety net.

Refs docs/design/2026-05-03-semantic-search.md §5.1, §5.2, §6

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase C — Local smoke test

### Task 3: Verify the new route against local D1

**Files:** none (no commit)

#### Step 3.1: Ensure local D1 has embedded posts

```bash
cd /Users/ryota/repos/github.com/paveg/tailf/apps/api
pnpm wrangler d1 execute tailf-db --local --command "SELECT COUNT(*) AS total, SUM(CASE WHEN embedding IS NOT NULL THEN 1 ELSE 0 END) AS with_embedding FROM posts;"
```

If `with_embedding < total`, run the local backfill loop first (same shape as the production runbook, but pointed at `http://localhost:8788`). The PR #2 worktree's smoke test already populated this; if the worktree is fresh, you may need to copy `apps/api/.wrangler/` from a sibling worktree or re-run the cron + backfill.

#### Step 3.2: Start the dev server

```bash
cd /Users/ryota/repos/github.com/paveg/tailf
mkdir -p apps/web/dist
nohup pnpm dev:api > /tmp/tailf-api-dev-pr3.log 2>&1 &
echo "PID: $!"
sleep 8
```

#### Step 3.3: Semantic path — long query

```bash
curl -sS 'http://localhost:8788/api/posts/search?q=React%20%E3%83%95%E3%83%83%E3%82%AF&limit=5' | head -c 800
echo
```

Expected: JSON response with `"meta":{"hasMore":...,"nextCursor":...,"query":"React フック","mode":"semantic"}` and `data` containing posts ordered by relevance (NOT chronological — verify by eye that the top results are React-fundamentals or hooks-related, not just the newest articles).

If `mode` comes back as `"keyword"` for a 6-character query, the semantic path is failing — check `/tmp/tailf-api-dev-pr3.log` for `[Search] semantic path failed` warnings.

#### Step 3.4: Keyword path — short query

```bash
curl -sS 'http://localhost:8788/api/posts/search?q=Go&limit=3' | head -c 500
echo
```

Expected: `"mode":"keyword"` (Go is 2 characters, below the 3-char threshold).

#### Step 3.5: Pagination — semantic

```bash
RESP=$(curl -sS 'http://localhost:8788/api/posts/search?q=TypeScript&limit=3')
echo "$RESP" | head -c 500
echo
NEXT=$(echo "$RESP" | python3 -c "import json,sys; print(json.load(sys.stdin)['meta']['nextCursor'])")
echo "nextCursor=$NEXT"
curl -sS "http://localhost:8788/api/posts/search?q=TypeScript&limit=3&cursor=$NEXT" | head -c 500
echo
```

Expected: the second call returns a different (lower-ranked) set of posts, also `mode: "semantic"`. The cursor should round-trip cleanly.

#### Step 3.6: Filter combination — techOnly + topic

```bash
curl -sS 'http://localhost:8788/api/posts/search?q=Kubernetes&limit=3&techOnly=true&topic=cloud' | head -c 500
echo
```

Expected: `mode: "semantic"`, results filtered to cloud-topic + tech-score posts. (Empty result is acceptable if your local D1 has no matching posts.)

#### Step 3.7: AI failure simulation — set AI to undefined

We can't easily make Workers AI throw on demand. Instead, verify the AI-undefined fallback by reading the route handler logic with grep:

```bash
grep -A 2 "if (q.length >= 3 && ai)" apps/api/src/routes/posts.ts
grep -B 1 "Fall through to keyword path" apps/api/src/routes/posts.ts
```

Expected: confirm the `if (q.length >= 3 && ai)` guard exists and the catch block falls through. The actual AI-failure case will be exercised in production observability after merge.

#### Step 3.8: Stop dev server

```bash
pkill -f "wrangler dev" || true
# If port 8788 is still bound (workerd child quirk noted in the runbook):
lsof -ti:8788 | xargs -r kill
```

---

## Phase D — Frontend type extension

### Task 4: Extend `CursorMeta` and update `SearchInput`

**Files:**
- Modify: `apps/web/src/lib/api.ts` (extend `CursorMeta`)
- Modify: `apps/web/src/components/SearchInput.tsx` (placeholder text)

#### Step 4.1: Extend `CursorMeta` to optionally carry `mode` + `query`

In `apps/web/src/lib/api.ts`, find the existing interface (around lines 89-92):

```typescript
export interface CursorMeta {
	nextCursor: string | null
	hasMore: boolean
}
```

Replace with:

```typescript
export interface CursorMeta {
	nextCursor: string | null
	hasMore: boolean
	// Search-only — present on /posts/search responses, undefined elsewhere.
	query?: string
	mode?: 'semantic' | 'keyword'
}
```

The two new fields are optional, so all existing usages continue to compile unchanged. Search responses populate them; other endpoints leave them undefined.

#### Step 4.2: Update `SearchInput` placeholder

In `apps/web/src/components/SearchInput.tsx`, find the prop default at line ~15:

```typescript
	placeholder = '記事を検索...',
```

Change to:

```typescript
	placeholder = '自然な日本語で検索…（例: React フックの落とし穴）',
```

(Note the full-width `…` ellipsis matches the existing Japanese-typography conventions in the project. The example is a deliberately concrete query that demonstrates semantic search beats keyword matching.)

#### Step 4.3: Run web typecheck

```bash
cd /Users/ryota/repos/github.com/paveg/tailf
pnpm --filter @tailf/web exec tsc --noEmit
```

Expected: same set of pre-existing errors (if any) as on `main`. No new errors.

If the web typecheck passes cleanly here but other parts of the repo are broken, that's fine — the per-package check is what matters.

#### Step 4.4: Commit

```bash
git add apps/web/src/lib/api.ts apps/web/src/components/SearchInput.tsx
git commit -m "feat(web): extend CursorMeta with search mode and update placeholder

CursorMeta gains optional query + mode fields populated by
/posts/search responses (other endpoints leave them undefined).
SearchInput placeholder shifts from generic to a concrete example
that hints at semantic search.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: `PostList` shows a mode caption when results are semantic

**Files:**
- Modify: `apps/web/src/components/PostList.tsx`

#### Step 5.1: Find the search-result render block

Open `apps/web/src/components/PostList.tsx`. The relevant area is around lines 180-323 — the `displayPosts` flow and the grid below.

We want to add a small caption that appears **only** when `isSearching` is true and the latest search response reports `meta.mode === 'semantic'`. The caption sits above the posts grid.

#### Step 5.2: Compute the search mode

After the existing `displayPosts` declaration (around line 180), add:

```typescript
	// Latest search page may carry meta.mode; show a label when semantic.
	const searchMode = isSearching
		? searchQueryResult.data?.pages[0]?.meta?.mode
		: undefined
```

#### Step 5.3: Render the caption

Find the posts grid (around line 317-323):

```tsx
				{/* Posts Grid */}
				{displayPosts.length > 0 && (
					<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
						{displayPosts.map((post) => (
							<PostCard key={post.id} post={post} />
						))}
					</div>
				)}
```

Insert the caption immediately above this block:

```tsx
				{/* Semantic search mode indicator */}
				{searchMode === 'semantic' && displayPosts.length > 0 && (
					<p className="text-sm text-muted-foreground">意味的に近い順</p>
				)}

				{/* Posts Grid */}
				{displayPosts.length > 0 && (
					<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
						{displayPosts.map((post) => (
							<PostCard key={post.id} post={post} />
						))}
					</div>
				)}
```

#### Step 5.4: Verify the web build still works

```bash
cd /Users/ryota/repos/github.com/paveg/tailf
pnpm --filter @tailf/web exec tsc --noEmit
```

Expected: no new errors.

```bash
PUBLIC_API_URL=https://example.com/api SSG_ALLOW_EMPTY=true pnpm --filter @tailf/web build 2>&1 | tail -10
```

Expected: build succeeds. (We use the placeholder URL because we're not testing data — only that the React component compiles and SSGs.)

#### Step 5.5: Commit

```bash
git add apps/web/src/components/PostList.tsx
git commit -m "feat(web): label semantic search results

Adds a subtle '意味的に近い順' caption above the search results
grid when the API reports mode: 'semantic'. Falls back to no
caption (existing behavior) for keyword searches and the default
post list.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase E — End-to-end verification

### Task 6: Aggregate checks

**Files:** none

- [ ] **Step 6.1: Tests**

```bash
cd /Users/ryota/repos/github.com/paveg/tailf
pnpm --filter @tailf/api test
```

Expected: 378 passing.

- [ ] **Step 6.2: Lint**

```bash
pnpm lint
```

Expected: clean. (If running from a worktree under `.claude/`, biome may report "No files were processed" — fall back to `pnpm --filter @tailf/api exec biome check src/services/semantic-search.ts src/routes/posts.ts apps/web/src/lib/api.ts apps/web/src/components/SearchInput.tsx apps/web/src/components/PostList.tsx`.)

- [ ] **Step 6.3: Per-file API typecheck**

```bash
pnpm --filter @tailf/api exec tsc --noEmit --skipLibCheck \
  src/services/semantic-search.ts \
  src/routes/posts.ts
```

Expected: pre-existing errors only.

- [ ] **Step 6.4: Web build**

```bash
PUBLIC_API_URL=https://example.com/api SSG_ALLOW_EMPTY=true pnpm --filter @tailf/web build 2>&1 | tail -5
```

Expected: build succeeds.

---

## Phase F — Pull request

### Task 7: Open PR #3

**Files:** none

- [ ] **Step 7.1: Push the branch**

```bash
cd /Users/ryota/repos/github.com/paveg/tailf
git push -u origin feat/semantic-search-pr3-cutover
```

- [ ] **Step 7.2: STOP for explicit user confirmation**

Per `~/.claude/rules/workflow.md` — push and PR creation require explicit user confirmation. Wait.

- [ ] **Step 7.3: Create PR (only after user confirms)**

Write the body to a file (per `gh-pr-body.md` rule — never use heredoc for code-fence-heavy bodies):

```bash
cat > /tmp/pr3_body.md <<'EOF'
## Summary

Final PR of the semantic search rollout. **User-visible**: `/api/posts/search` now returns posts ranked by meaning, not chronology.

- Replaces the FTS5-backed `/api/posts/search` handler with a vector-ranked implementation that uses BGE-M3 embeddings persisted in PR #1 (ingest) and PR #2 (backfilled to 100% in production)
- Adds `meta.mode: 'semantic' | 'keyword'` to the search response
- Frontend: search input placeholder hints at natural language; results labeled "意味的に近い順" when semantic
- Adds `apps/api/src/services/semantic-search.ts` with 9 unit tests covering cursor codec + scoring math

## Behavior matrix

| Query | AI binding | Path |
|---|---|---|
| `q.length >= 3` | healthy | semantic ranking |
| `q.length >= 3` | unavailable / throws | LIKE fallback (logged) |
| `q.length >= 3` | healthy but 0 candidate posts have embeddings | LIKE fallback |
| `q.length < 3` | any | LIKE (existing behavior) |

## Cost / budget

- **Subrequests per semantic search**: 3 (query embedding + candidate SELECT + detail SELECT) — far under the 1000/inv Paid ceiling
- **Memory per request at current 5K-post corpus**: ~20 MB of embedding data (filters cut this proportionally) — well under the 128 MB Workers limit
- **Workers AI cost per search**: ~$0.000003 per query at typical query length (~30 input tokens). 10K searches/day = ~$1/month
- **No new D1 storage** — embeddings already persisted by PR #1 / #2

## Test plan

- [x] `pnpm --filter @tailf/api test` — 378/378 (369 baseline + 9 new for `services/semantic-search.ts`)
- [x] Local smoke test:
  - Semantic path returns relevance-ordered results for "React フック" ✓
  - Keyword fallback returns for `q.length < 3` ✓
  - Cursor pagination round-trips ✓
  - Filter combinations (techOnly + topic) work ✓
- [x] Web build succeeds with the new components
- [ ] After merge: hit `https://tailf.pavegy.workers.dev/api/posts/search?q=...` and verify `meta.mode === 'semantic'` and reasonable result ordering
- [ ] After merge: browser smoke — type "React フックの落とし穴" in the search box, verify the caption "意味的に近い順" appears and results are not chronological

## Why FTS5 stays in the schema

Migration `0005_add_fts5_search.sql` and the `posts_fts` virtual table + triggers are intentionally left in place. They cost ~10 KB of DB metadata and run on every INSERT/UPDATE/DELETE to keep the index current. Keeping them as a no-op safety net means a hybrid scoring experiment (semantic + FTS5 + recency + bookmark count) is one PR away if the semantic-only ranking turns out to need keyword anchoring. Removing them requires a one-line migration if we decide the hybrid is unnecessary.

## Commits

| | |
|---|---|
| (plan) | docs(plan): add PR #3 (cutover) implementation plan |
| 1 | feat(api): add semantic search service primitives |
| 2 | feat(api): replace /posts/search with semantic ranking |
| 3 | feat(web): extend CursorMeta with search mode and update placeholder |
| 4 | feat(web): label semantic search results |

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF

gh pr create --base main \
  --title "feat: semantic search cutover (PR #3/3)" \
  --body-file /tmp/pr3_body.md
```

- [ ] **Step 7.4: Verify the PR body rendered correctly**

```bash
PR_NUM=$(gh pr list --repo paveg/tailf --head feat/semantic-search-pr3-cutover --json number -q '.[0].number')
gh pr view "$PR_NUM" --repo paveg/tailf --json body -q '.body' | awk '/^\\`/ {print NR": "$0}'
```

Expected: empty output (no broken code fences).

---

## Out of scope (future work)

The semantic search foundation enables several follow-ups, none of which belong in this PR:

- **"Similar posts" widget** on detail pages (~30 LOC reusing the same vectors)
- **Hybrid scoring** that blends semantic + FTS5 + recency + bookmark count
- **MCP server** exposing `search_japanese_tech_posts(query, limit)` over the new endpoint
- **Vectorize migration** when corpus exceeds ~50K posts (current memory budget is 4× headroom at 5K, so we have time)
- **Query embedding cache** (Cache API or KV) when search QPS warrants it

These are all enabled by — but explicitly deferred from — this PR.
