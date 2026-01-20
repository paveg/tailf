/**
 * Build cursor-based pagination response from query result.
 * Expects results fetched with limit + 1 to determine hasMore.
 */
export function buildCursorResponse<T extends { publishedAt: Date }>(
	results: T[],
	limit: number,
): {
	data: T[]
	meta: { nextCursor: string | null; hasMore: boolean }
} {
	const hasMore = results.length > limit
	const data = hasMore ? results.slice(0, limit) : results
	const nextCursor =
		hasMore && data.length > 0 ? data[data.length - 1].publishedAt.toISOString() : null

	return {
		data,
		meta: { nextCursor, hasMore },
	}
}
