# Semantic Search — PR #1 (Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an `embedding` BLOB column to `posts`, introduce a single `services/embedding.ts` that wraps BGE-M3 calls, and wire the existing tech-score ingest path so every newly-fetched post stores its L2-normalized embedding. No user-visible change.

**Architecture:** Centralize BGE-M3 access in `services/embedding.ts` (returns L2-normalized `Float32Array`). Extend `tech-score.ts` with `embedAndScoreBatch` that returns embeddings alongside scores. Modify `rss.ts` and `routes/feeds.ts` to persist embeddings during their existing batch flows. Schema migration adds a nullable BLOB column so backfill (PR #2) can run incrementally.

**Tech Stack:** Cloudflare Workers, Hono, Drizzle ORM, D1 (SQLite), Workers AI (`@cf/baai/bge-m3`), Vitest, `@cloudflare/vitest-pool-workers`.

**Reference spec:** `docs/design/2026-05-03-semantic-search.md` §3, §4, §7, §10 (PR #1 row).

---

## Testing scope note

The repo's vitest config (`apps/api/vitest.config.ts`) runs in **plain Node**, not the Workers pool. Existing tests under `apps/api/src/**/*.test.ts` are unit-only — they replicate schemas inline and explicitly comment that "actual routes depend on D1 database" so they don't exercise persistence. **Setting up a Workers-pool integration harness is out of scope for this PR.**

What that means for this plan:

- Pure-function additions (`embedding.ts`, `embedAndScoreBatch`) get full unit-test coverage (Tasks 2, 5).
- Persistence-side changes in `rss.ts` and `routes/feeds.ts` are verified by the local D1 smoke test in Task 8.4/8.5 — `length(embedding) = 4096` on freshly-fetched rows is the green light.
- Adding integration tests against a real D1 belongs in its own PR (would adopt `@cloudflare/vitest-pool-workers` which is already in `devDependencies` but not wired into `vitest.config.ts`).

## Pre-flight

### Task 0: Branch and dependency check

**Files:** none

- [ ] **Step 0.1: Confirm branch**

```bash
git -C /Users/ryota/repos/github.com/paveg/tailf branch --show-current
```

Expected: `feat/semantic-search-design` (the spec branch). Continue from this branch — PR #1 will be created from a child branch.

- [ ] **Step 0.2: Create implementation branch**

```bash
cd /Users/ryota/repos/github.com/paveg/tailf
git checkout -b feat/semantic-search-pr1-foundation
```

- [ ] **Step 0.3: Confirm clean baseline tests**

```bash
cd /Users/ryota/repos/github.com/paveg/tailf
pnpm --filter @tailf/api test
```

Expected: all tests pass. If any fail, STOP and surface failures — do not begin implementation on a red baseline.

- [ ] **Step 0.4: Note dependency on Drizzle PR #47**

`chore(deps): Bump drizzle-orm from 0.38.4 to 0.45.2` is open. PR #1 keeps the current `0.38.x` so it can land independently. If #47 has merged before this plan runs, rebase first and re-run Step 0.3.

---

## Phase A — Schema migration

### Task 1: Add `embedding` column to schema

**Files:**
- Modify: `apps/api/src/db/schema.ts:59-88` (the `posts` table block)

- [ ] **Step 1.1: Edit schema**

Add `blob` to the import on line 2:

```typescript
import { blob, index, integer, primaryKey, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'
```

Inside the `posts` table definition (after `subTopic` on line 75, before `createdAt`):

```typescript
		// L2-normalized BGE-M3 (1024-dim float32) packed as little-endian bytes.
		// NULL until backfilled (see PR #2). 4096 bytes per row.
		embedding: blob('embedding'),
```

No new index — adding a partial index from Drizzle 0.38.x is risky and the search query in PR #3 won't need it for a 5K-row corpus. PR #2 or #3 can add one if profiling shows it matters.

- [ ] **Step 1.2: Generate migration**

```bash
cd /Users/ryota/repos/github.com/paveg/tailf
pnpm db:generate
```

Expected: drizzle-kit creates `apps/api/migrations/0010_*.sql` plus a new snapshot under `apps/api/migrations/meta/`. The `dump-schema.sh` script (per `apps/api/package.json` `db:generate`) also runs.

- [ ] **Step 1.3: Inspect the generated migration**

```bash
ls -t /Users/ryota/repos/github.com/paveg/tailf/apps/api/migrations/*.sql | head -1
cat $(ls -t /Users/ryota/repos/github.com/paveg/tailf/apps/api/migrations/*.sql | head -1)
```

Expected SQL roughly:

```sql
ALTER TABLE `posts` ADD `embedding` blob;
```

If the output diverges materially (extra ALTERs, dropped columns), STOP and re-check Task 1.1. **Never hand-edit** the migration file (per `~/.claude/rules/development-principles.md` — Database Migrations).

- [ ] **Step 1.4: Apply migration locally**

```bash
cd /Users/ryota/repos/github.com/paveg/tailf
pnpm db:migrate:local
```

Expected: `✔ ... migrations applied`. Re-running should report `No migrations to apply.`

- [ ] **Step 1.5: Verify schema applied**

```bash
cd /Users/ryota/repos/github.com/paveg/tailf/apps/api
pnpm wrangler d1 execute tailf-db --local --command "PRAGMA table_info(posts);"
```

Expected: row listing `embedding` with type `BLOB`, `notnull = 0`.

- [ ] **Step 1.6: Run baseline tests against migrated schema**

```bash
cd /Users/ryota/repos/github.com/paveg/tailf
pnpm --filter @tailf/api test
```

Expected: still all green. Schema addition alone must not break anything.

- [ ] **Step 1.7: Commit**

```bash
cd /Users/ryota/repos/github.com/paveg/tailf
git add apps/api/src/db/schema.ts apps/api/migrations/
git commit -m "feat(db): add nullable embedding BLOB column to posts

Stores L2-normalized BGE-M3 vectors (1024 float32, 4096 bytes/row).
Nullable so PR #2 can backfill incrementally without blocking ingest.

Refs docs/design/2026-05-03-semantic-search.md §4

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase B — Embedding service (TDD)

### Task 2: Create embedding service test scaffold

**Files:**
- Create: `apps/api/src/services/embedding.test.ts`

- [ ] **Step 2.1: Write the failing test for `normalize`**

```typescript
import { describe, expect, it } from 'vitest'
import { decodeEmbedding, encodeEmbedding, normalize } from './embedding'

describe('normalize', () => {
	it('returns a unit vector', () => {
		const v = new Float32Array([3, 4, 0, 0])
		const out = normalize(v)
		const norm = Math.sqrt(out.reduce((s, x) => s + x * x, 0))
		expect(norm).toBeCloseTo(1, 6)
		expect(out[0]).toBeCloseTo(0.6, 6)
		expect(out[1]).toBeCloseTo(0.8, 6)
	})

	it('returns the input unchanged for the zero vector', () => {
		const v = new Float32Array([0, 0, 0, 0])
		const out = normalize(v)
		expect(Array.from(out)).toEqual([0, 0, 0, 0])
	})
})

describe('encodeEmbedding / decodeEmbedding', () => {
	it('round-trips Float32Array through Uint8Array losslessly', () => {
		const v = new Float32Array([0.1, -0.2, 0.3, 0.4])
		const blob = encodeEmbedding(v)
		expect(blob).toBeInstanceOf(Uint8Array)
		expect(blob.byteLength).toBe(16)
		const back = decodeEmbedding(blob)
		expect(back).toBeInstanceOf(Float32Array)
		expect(Array.from(back)).toEqual(Array.from(v))
	})

	it('decodes BLOBs that come from D1 with non-zero byteOffset', () => {
		const buf = new ArrayBuffer(20)
		const v = new Float32Array([1, 2, 3, 4])
		new Uint8Array(buf, 4, 16).set(new Uint8Array(v.buffer))
		const blob = new Uint8Array(buf, 4, 16)
		const back = decodeEmbedding(blob)
		expect(Array.from(back)).toEqual([1, 2, 3, 4])
	})
})
```

- [ ] **Step 2.2: Run the test to confirm it fails**

```bash
cd /Users/ryota/repos/github.com/paveg/tailf
pnpm --filter @tailf/api test embedding
```

Expected: FAIL with `Cannot find module './embedding'` (or similar resolution error).

### Task 3: Implement embedding service

**Files:**
- Create: `apps/api/src/services/embedding.ts`

- [ ] **Step 3.1: Write the implementation**

```typescript
/**
 * Single entrypoint for BGE-M3 vector operations.
 * All callers should use `compute` / `computeBatch` instead of `ai.run` directly,
 * so we can centralize batching, normalization, and storage encoding.
 */

const MODEL = '@cf/baai/bge-m3'

export const EMBEDDING_DIM = 1024

export async function compute(ai: Ai, text: string): Promise<Float32Array> {
	const result = await ai.run(MODEL, { text: [text] })
	return normalize(new Float32Array(result.data[0]))
}

export async function computeBatch(ai: Ai, texts: string[]): Promise<Float32Array[]> {
	if (texts.length === 0) return []
	const result = await ai.run(MODEL, { text: texts })
	return result.data.map((v: number[]) => normalize(new Float32Array(v)))
}

export function normalize(v: Float32Array): Float32Array {
	let sumSq = 0
	for (let i = 0; i < v.length; i++) sumSq += v[i] * v[i]
	if (sumSq === 0) return v
	const norm = Math.sqrt(sumSq)
	const out = new Float32Array(v.length)
	for (let i = 0; i < v.length; i++) out[i] = v[i] / norm
	return out
}

export function encodeEmbedding(v: Float32Array): Uint8Array {
	// Copy so we never accidentally hand callers a view into a larger buffer.
	const out = new Uint8Array(v.byteLength)
	out.set(new Uint8Array(v.buffer, v.byteOffset, v.byteLength))
	return out
}

export function decodeEmbedding(blob: Uint8Array): Float32Array {
	// D1 may return a Uint8Array view at a non-aligned byteOffset; copy
	// into a fresh ArrayBuffer so Float32Array construction is always safe.
	const out = new Float32Array(blob.byteLength / 4)
	new Uint8Array(out.buffer).set(blob)
	return out
}
```

- [ ] **Step 3.2: Run the test to confirm it passes**

```bash
cd /Users/ryota/repos/github.com/paveg/tailf
pnpm --filter @tailf/api test embedding
```

Expected: PASS for `normalize`, `encodeEmbedding / decodeEmbedding`.

- [ ] **Step 3.3: Commit**

```bash
cd /Users/ryota/repos/github.com/paveg/tailf
git add apps/api/src/services/embedding.ts apps/api/src/services/embedding.test.ts
git commit -m "feat(api): add embedding service for BGE-M3 vector ops

Centralizes ai.run('@cf/baai/bge-m3') calls behind a typed
Float32Array surface, with L2-normalize and BLOB encode/decode
helpers. No call sites switched yet — that follows in Task 5.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase C — Refactor tech-score onto the embedding service

### Task 4: Replace direct `ai.run` calls in tech-score with embedding service

**Files:**
- Modify: `apps/api/src/services/tech-score.ts:521-535` (`getAnchorEmbeddings`)
- Modify: `apps/api/src/services/tech-score.ts:579-590` (`calculateTechScoreWithEmbedding`)
- Modify: `apps/api/src/services/tech-score.ts:633-641` (`calculateTechScoresBatch`)

- [ ] **Step 4.1: Add import**

At the top of `apps/api/src/services/tech-score.ts`, alongside the existing import on line 5, add:

```typescript
import { compute, computeBatch } from './embedding'
```

- [ ] **Step 4.2: Refactor `getAnchorEmbeddings`**

Replace the body of `getAnchorEmbeddings` (lines 521-535) with:

```typescript
async function getAnchorEmbeddings(ai: Ai): Promise<{ tech: number[][]; nonTech: number[][] }> {
	if (techAnchorEmbeddings && nonTechAnchorEmbeddings) {
		return { tech: techAnchorEmbeddings, nonTech: nonTechAnchorEmbeddings }
	}

	const [tech, nonTech] = await Promise.all([
		computeBatch(ai, TECH_ANCHOR_PHRASES),
		computeBatch(ai, NON_TECH_ANCHOR_PHRASES),
	])

	techAnchorEmbeddings = tech.map((v) => Array.from(v))
	nonTechAnchorEmbeddings = nonTech.map((v) => Array.from(v))

	return { tech: techAnchorEmbeddings, nonTech: nonTechAnchorEmbeddings }
}
```

Note: anchors are now L2-normalized (a behavior change in numeric output but not in semantic ranking — the existing `cosineSimilarity` already divides by norms, and normalized inputs make `cosineSimilarity` reduce to dot product, returning identical values). The anchor cache continues to hold `number[][]` to avoid further changes downstream in this PR.

- [ ] **Step 4.3: Refactor `calculateTechScoreWithEmbedding` (single)**

Within the `try` block (lines 579-590), replace the `Promise.all` and immediate use:

```typescript
		const [inputVec, anchors] = await Promise.all([
			compute(ai, text),
			getAnchorEmbeddings(ai),
		])

		const embeddingScore = calculateEmbeddingScore(
			Array.from(inputVec),
			anchors.tech,
			anchors.nonTech,
		)
```

(`compute` was already added to the import in Step 4.1.)

- [ ] **Step 4.4: Refactor `calculateTechScoresBatch`**

Within the `try` block (lines 633-648), replace the `Promise.all` and the `.map`:

```typescript
		const [inputVecs, anchors] = await Promise.all([
			computeBatch(ai, texts),
			getAnchorEmbeddings(ai),
		])

		return inputVecs.map((inputVec, index) => {
			const embeddingScore = calculateEmbeddingScore(
				Array.from(inputVec),
				anchors.tech,
				anchors.nonTech,
			)
			const keywordScore = keywordScores[index]
			const hybridScore = keywordScore * KEYWORD_WEIGHT + embeddingScore * EMBEDDING_WEIGHT
			return Math.min(hybridScore, 1.0)
		})
```

- [ ] **Step 4.5: Run the existing tech-score tests**

```bash
cd /Users/ryota/repos/github.com/paveg/tailf
pnpm --filter @tailf/api test tech-score
```

Expected: PASS. Existing tests are keyword-based and don't exercise AI; they verify the refactor didn't break the surface API.

- [ ] **Step 4.6: Run the full suite**

```bash
cd /Users/ryota/repos/github.com/paveg/tailf
pnpm --filter @tailf/api test
```

Expected: PASS across all suites. (The refactor changes internals only — public function signatures are unchanged.)

- [ ] **Step 4.7: Commit**

```bash
cd /Users/ryota/repos/github.com/paveg/tailf
git add apps/api/src/services/tech-score.ts
git commit -m "refactor(api): route tech-score embeddings through embedding service

Replaces direct ai.run('@cf/baai/bge-m3') calls with the new
embedding.compute / computeBatch helpers. Anchor embeddings are now
L2-normalized; cosine similarity values are unchanged for normalized
inputs since cosine reduces to a dot product.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase D — Persist embeddings during ingest (TDD-driven)

### Task 5: Add `embedAndScoreBatch` (returns scores + raw vectors)

**Files:**
- Modify: `apps/api/src/services/tech-score.ts` (append new export at end of file, after `calculateTechScoresBatch`)
- Modify: `apps/api/src/services/tech-score.test.ts` (append new describe block)

- [ ] **Step 5.1: Write the failing test**

Append to `apps/api/src/services/tech-score.test.ts`:

```typescript
import { embedAndScoreBatch } from './tech-score'

describe('embedAndScoreBatch', () => {
	it('returns one entry per input post', async () => {
		const fakeAi = {
			run: async (_model: string, input: { text: string[] }) => ({
				data: input.text.map(() => new Array(1024).fill(0.01)),
			}),
		} as unknown as Ai

		const result = await embedAndScoreBatch(fakeAi, [
			{ title: 'TypeScript入門', summary: 'A guide' },
			{ title: 'カフェ巡り', summary: undefined },
		])
		expect(result).toHaveLength(2)
		expect(result[0].embedding).toBeInstanceOf(Float32Array)
		expect(result[0].embedding.length).toBe(1024)
		expect(typeof result[0].techScore).toBe('number')
		expect(result[0].techScore).toBeGreaterThanOrEqual(0)
		expect(result[0].techScore).toBeLessThanOrEqual(1)
	})

	it('returns keyword-only scores and null embeddings when AI is undefined', async () => {
		const result = await embedAndScoreBatch(undefined, [
			{ title: 'TypeScript入門', summary: undefined },
		])
		expect(result).toHaveLength(1)
		expect(result[0].embedding).toBeNull()
		expect(result[0].techScore).toBeGreaterThanOrEqual(0.3)
	})

	it('returns keyword scores and null embeddings when AI throws', async () => {
		const failingAi = {
			run: async () => {
				throw new Error('boom')
			},
		} as unknown as Ai
		const result = await embedAndScoreBatch(failingAi, [
			{ title: 'TypeScript入門', summary: undefined },
		])
		expect(result[0].embedding).toBeNull()
		expect(result[0].techScore).toBeGreaterThanOrEqual(0.3)
	})

	it('returns [] for empty input', async () => {
		const result = await embedAndScoreBatch(undefined, [])
		expect(result).toEqual([])
	})
})
```

- [ ] **Step 5.2: Run the test to confirm it fails**

```bash
cd /Users/ryota/repos/github.com/paveg/tailf
pnpm --filter @tailf/api test tech-score
```

Expected: FAIL with `embedAndScoreBatch is not exported` or similar.

- [ ] **Step 5.3: Implement `embedAndScoreBatch`**

Append to `apps/api/src/services/tech-score.ts`:

```typescript
/**
 * Compute embeddings AND tech scores for a batch of posts in a single pass.
 * Returns the raw L2-normalized embedding alongside the score so callers can
 * persist it. On AI failure or absence, embedding is null and the score
 * falls back to keyword-only.
 */
export async function embedAndScoreBatch(
	ai: Ai | undefined,
	posts: Array<{ title: string; summary?: string }>,
): Promise<Array<{ embedding: Float32Array | null; techScore: number }>> {
	if (posts.length === 0) return []

	const keywordScores = posts.map((p) => calculateTechScore(p.title, p.summary))

	if (!ai) {
		return keywordScores.map((techScore) => ({ embedding: null, techScore }))
	}

	const texts = posts.map((p) => decodeHtmlEntities(`${p.title} ${p.summary || ''}`))

	try {
		const [inputVecs, anchors] = await Promise.all([
			computeBatch(ai, texts),
			getAnchorEmbeddings(ai),
		])

		return inputVecs.map((inputVec, index) => {
			const embeddingScore = calculateEmbeddingScore(
				Array.from(inputVec),
				anchors.tech,
				anchors.nonTech,
			)
			const hybridScore = keywordScores[index] * KEYWORD_WEIGHT + embeddingScore * EMBEDDING_WEIGHT
			return {
				embedding: inputVec,
				techScore: Math.min(hybridScore, 1.0),
			}
		})
	} catch (error) {
		console.error('[TechScore] embedAndScoreBatch failed, keyword fallback:', error)
		return keywordScores.map((techScore) => ({ embedding: null, techScore }))
	}
}
```

- [ ] **Step 5.4: Run the test to confirm it passes**

```bash
cd /Users/ryota/repos/github.com/paveg/tailf
pnpm --filter @tailf/api test tech-score
```

Expected: PASS, all four new cases.

- [ ] **Step 5.5: Commit**

```bash
cd /Users/ryota/repos/github.com/paveg/tailf
git add apps/api/src/services/tech-score.ts apps/api/src/services/tech-score.test.ts
git commit -m "feat(api): add embedAndScoreBatch returning vectors with scores

Lets ingest paths persist embeddings without a second AI round-trip.
Existing calculateTechScoresBatch stays for any caller that only needs
scores.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 6: Wire embeddings into RSS ingest

**Files:**
- Modify: `apps/api/src/services/rss.ts:273-284` (`postsToInsert` typing)
- Modify: `apps/api/src/services/rss.ts:402-427` (the embedding score update block)

**No new vitest tests in this task.** Per the testing-scope note above, the persistence path can't be exercised against a real D1 in the current test environment. Coverage for the new behavior comes from:
- Task 5's unit test for `embedAndScoreBatch` (already verifies the input → `{embedding, techScore}` contract)
- The local D1 smoke test in Task 8.4/8.5 (verifies the BLOB actually lands)

- [ ] **Step 6.1: Add the embedding field to the inline `postsToInsert` shape**

In `apps/api/src/services/rss.ts:273-284`, extend the inline type to include the new column:

```typescript
	const postsToInsert: Array<{
		id: string
		title: string
		summary: string | null
		url: string
		thumbnailUrl: string | null
		publishedAt: Date
		feedId: string
		techScore: number
		mainTopic: string | null
		subTopic: string | null
		embedding: Uint8Array | null
	}> = []
```

In the `postsToInsert.push({...})` block at lines 347-358, add `embedding: null` as the final field:

```typescript
				postsToInsert.push({
					id: postId,
					title: item.title,
					summary,
					url: item.link,
					thumbnailUrl: item.thumbnail ?? null,
					publishedAt,
					feedId: feed.id,
					techScore: keywordScore,
					mainTopic,
					subTopic,
					embedding: null,
				})
```

- [ ] **Step 6.2: Replace the embedding-score block to use `embedAndScoreBatch`**

At the top of `apps/api/src/services/rss.ts`, replace the `calculateTechScoresBatch` import with `embedAndScoreBatch`. Then replace lines 402-427 with:

```typescript
	// Batch compute embeddings AND tech scores in one AI call,
	// then persist both to each post.
	if (ai && postsToInsert.length > 0) {
		console.log(`[Embed] Batch embedding ${postsToInsert.length} new posts...`)
		try {
			const postsForScoring = postsToInsert.map((p) => ({
				title: p.title,
				summary: p.summary ?? undefined,
			}))
			const results = await embedAndScoreBatch(ai, postsForScoring)

			for (let i = 0; i < postsToInsert.length; i++) {
				const result = results[i]
				const update: { techScore: number; embedding?: Uint8Array } = {
					techScore: result.techScore,
				}
				if (result.embedding) {
					update.embedding = encodeEmbedding(result.embedding)
				}
				await db.update(posts).set(update).where(eq(posts.id, postsToInsert[i].id))
			}
			const withEmbedding = results.filter((r) => r.embedding).length
			console.log(
				`[Embed] Updated ${postsToInsert.length} posts (${withEmbedding} with embeddings)`,
			)
		} catch (error) {
			console.warn('[Embed] embedAndScoreBatch failed, keeping keyword scores:', error)
		}
	}
```

Add the import for `encodeEmbedding` at the top of the file (alongside other service imports):

```typescript
import { encodeEmbedding } from './embedding'
import { embedAndScoreBatch } from './tech-score'
```

(Remove the now-unused `calculateTechScoresBatch` import if it's no longer referenced in `rss.ts`.)

- [ ] **Step 6.3: Run the existing test suite for regressions**

```bash
cd /Users/ryota/repos/github.com/paveg/tailf
pnpm --filter @tailf/api test
```

Expected: green. Persistence verification happens in Task 8.

- [ ] **Step 6.4: Commit**

```bash
cd /Users/ryota/repos/github.com/paveg/tailf
git add apps/api/src/services/rss.ts
git commit -m "feat(rss): persist embeddings on newly fetched posts

Replaces calculateTechScoresBatch with embedAndScoreBatch in the cron
ingest path so the BLOB embedding lands on the row in the same UPDATE
that writes the tech score. AI-less runs still work — embedding stays
NULL and PR #2 backfill picks them up later.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 7: Wire embeddings into the feed registration path

**Files:**
- Modify: `apps/api/src/routes/feeds.ts:194-237` (the embedding score / insert block in `POST /api/feeds`)

**No new vitest tests in this task.** Same rationale as Task 6 — `feeds.test.ts` does not exist (only `feed.test.ts` for a different route), and integration tests against D1 require the Workers pool which isn't configured. Verification falls to Task 8's smoke test (after registering a feed in dev, the inserted posts should have `length(embedding) = 4096`).

- [ ] **Step 7.1: Replace `calculateTechScoresBatch` with `embedAndScoreBatch`**

In `apps/api/src/routes/feeds.ts`, change the import from `calculateTechScoresBatch` to `embedAndScoreBatch`, and add `encodeEmbedding`:

```typescript
import { embedAndScoreBatch } from '../services/tech-score'
import { encodeEmbedding } from '../services/embedding'
```

Replace lines 202-208:

```typescript
		const results = await embedAndScoreBatch(
			c.env.AI,
			filteredItems.map((item) => ({
				title: item.title,
				summary: item.description?.slice(0, 500),
			})),
		)
```

Replace lines 211-233 (`for` loop) with:

```typescript
		let importedCount = 0
		for (let i = 0; i < filteredItems.length; i++) {
			const item = filteredItems[i]
			const { techScore, embedding } = results[i]
			try {
				const summary = item.description?.slice(0, 500)
				await db
					.insert(posts)
					.values({
						id: generateId(),
						title: item.title,
						summary,
						url: item.link,
						thumbnailUrl: item.thumbnail,
						publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
						feedId,
						techScore,
						embedding: embedding ? encodeEmbedding(embedding) : null,
					})
					.onConflictDoNothing()
				importedCount++
			} catch (e) {
				console.warn(`[Feed Register] Skip post: ${item.link}`, e)
			}
		}
```

- [ ] **Step 7.2: Run the existing test suite for regressions**

```bash
cd /Users/ryota/repos/github.com/paveg/tailf
pnpm --filter @tailf/api test
```

Expected: green.

- [ ] **Step 7.3: Commit**

```bash
cd /Users/ryota/repos/github.com/paveg/tailf
git add apps/api/src/routes/feeds.ts
git commit -m "feat(feeds): persist embeddings for posts imported on registration

POST /api/feeds now stores the BGE-M3 embedding alongside the tech score
in the same INSERT, using the new embedAndScoreBatch helper.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase E — End-to-end verification

### Task 8: Full repo checks

**Files:** none

- [ ] **Step 8.1: Type check**

```bash
cd /Users/ryota/repos/github.com/paveg/tailf
pnpm typecheck
```

Expected: clean.

- [ ] **Step 8.2: Lint**

```bash
cd /Users/ryota/repos/github.com/paveg/tailf
pnpm lint
```

Expected: clean. If Biome flags formatting, run `pnpm lint:fix` and re-stage.

- [ ] **Step 8.3: All tests**

```bash
cd /Users/ryota/repos/github.com/paveg/tailf
pnpm test
```

Expected: green.

- [ ] **Step 8.4: Local smoke test — verify embedding lands in dev D1**

In one terminal:

```bash
cd /Users/ryota/repos/github.com/paveg/tailf
pnpm dev:api
```

In another terminal, trigger the cron handler manually (the cron path is `0 * * * *` per `wrangler.toml`):

```bash
cd /Users/ryota/repos/github.com/paveg/tailf/apps/api
curl -X POST 'http://localhost:8788/__scheduled?cron=0+*+*+*+*'
```

Then query local D1:

```bash
cd /Users/ryota/repos/github.com/paveg/tailf/apps/api
pnpm wrangler d1 execute tailf-db --local --command "SELECT COUNT(*) as total, SUM(CASE WHEN embedding IS NOT NULL THEN 1 ELSE 0 END) as with_embedding FROM posts;"
```

Expected: `with_embedding > 0` after the cron runs (at minimum, any newly fetched posts have BLOBs). Posts that existed before this PR will still be NULL — that's correct; PR #2 backfills them.

If the cron fetches no new items (everything already exists), seed by deleting a recent row before the cron call, e.g.:

```bash
pnpm wrangler d1 execute tailf-db --local --command "DELETE FROM posts WHERE published_at = (SELECT MAX(published_at) FROM posts) LIMIT 1;"
```

Then re-run cron and re-query.

- [ ] **Step 8.5: Confirm BLOB byte size**

```bash
cd /Users/ryota/repos/github.com/paveg/tailf/apps/api
pnpm wrangler d1 execute tailf-db --local --command "SELECT id, length(embedding) as bytes FROM posts WHERE embedding IS NOT NULL LIMIT 3;"
```

Expected: every row reports `bytes = 4096`. Any other value means the float32 packing is wrong — STOP and re-check Task 3.

- [ ] **Step 8.6: Smoke-test the feed-registration path**

While `pnpm dev:api` is still running, register a fresh test feed (any small public RSS — pick one whose URL is **not** already in `apps/api/src/data/`):

```bash
# Replace AUTH_COOKIE with a valid session cookie obtained via local GitHub OAuth,
# or use whatever auth helper the project provides for dev.
curl -sS -X POST http://localhost:8788/api/feeds \
  -H 'Content-Type: application/json' \
  -H "Cookie: AUTH_COOKIE" \
  -d '{"feedUrl":"https://example.test/some-new-feed.xml"}'
```

Then verify posts inserted by that registration carry embeddings:

```bash
cd /Users/ryota/repos/github.com/paveg/tailf/apps/api
pnpm wrangler d1 execute tailf-db --local --command "SELECT count(*) FROM posts WHERE embedding IS NOT NULL AND created_at > strftime('%s','now','-5 minutes');"
```

Expected: count > 0. If the feed-registration step requires auth you can't easily satisfy in dev, skip this step and rely on Step 8.4 (cron path), which exercises the same `embedAndScoreBatch` → `encodeEmbedding` flow on a different code path.

---

## Phase F — Pull request

### Task 9: Open PR #1

**Files:** none

- [ ] **Step 9.1: Push the branch**

```bash
cd /Users/ryota/repos/github.com/paveg/tailf
git push -u origin feat/semantic-search-pr1-foundation
```

- [ ] **Step 9.2: Confirm with the user before opening the PR**

Per `~/.claude/rules/workflow.md` — "Push and PR creation require explicit user confirmation." Stop here and ask the user to confirm before proceeding to Step 9.3.

- [ ] **Step 9.3: Create PR (only after user confirms)**

```bash
cd /Users/ryota/repos/github.com/paveg/tailf
gh pr create --base main --title "feat(api): persist BGE-M3 embeddings on post ingest (semantic search PR #1/3)" --body "$(cat <<'EOF'
## Summary
- Adds nullable `posts.embedding` BLOB column (1024-d float32, L2-normalized, 4096 bytes/row) plus a partial index on present-only rows.
- Introduces `services/embedding.ts` as the single entrypoint for BGE-M3 calls (`compute`, `computeBatch`, `normalize`, `encodeEmbedding`, `decodeEmbedding`).
- Refactors `services/tech-score.ts` to route through the new service and adds `embedAndScoreBatch` returning vectors alongside scores.
- Updates RSS cron and `POST /api/feeds` to persist the embedding produced during the existing tech-score computation — **zero new AI calls**, the vector that was being thrown away is now saved.

This is foundation for semantic search. PR #2 will add an admin backfill endpoint for the ~5K existing posts; PR #3 swaps `/api/posts/search` to vector-rank.

Spec: `docs/design/2026-05-03-semantic-search.md` (PR #1 row in §10).

## Test plan
- [x] `pnpm test` green
- [x] `pnpm typecheck` clean
- [x] `pnpm lint` clean
- [x] Local D1 smoke: cron-fetched posts land with `length(embedding) = 4096`
- [ ] After merge: monitor first prod cron for `[Embed]` log lines and confirm `withEmbedding` count grows on new posts (a follow-up PR adds the status endpoint)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Notes for PR #2 and PR #3 (out of scope for this plan)

After PR #1 merges:

- **PR #2 — Backfill**: write a separate plan covering `POST /api/admin/embeddings/backfill`, `GET /api/admin/embeddings/status`, batched re-embedding of historical rows, and an ops runbook.
- **PR #3 — Cutover**: write a separate plan covering `services/semantic-search.ts`, replacing the `/api/posts/search` handler, `mode` field in response meta, and the frontend `SearchInput` placeholder + caption.

Defer those plans until PR #1 is in review/merged — empirical data from real cron runs will refine the assumptions.
