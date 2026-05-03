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
