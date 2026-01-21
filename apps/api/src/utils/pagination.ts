import { buildPopularCursor } from './cursor'

/**
 * Build cursor-based pagination response from query result.
 * Expects results fetched with limit + 1 to determine hasMore.
 *
 * @param results - Query results (limit + 1 items)
 * @param limit - Requested limit
 * @param sort - Sort type: 'recent' (default) or 'popular'
 */
export function buildCursorResponse<
	T extends { publishedAt: Date; hatenaBookmarkCount?: number | null },
>(
	results: T[],
	limit: number,
	sort: 'recent' | 'popular' = 'recent',
): {
	data: T[]
	meta: { nextCursor: string | null; hasMore: boolean }
} {
	const hasMore = results.length > limit
	const data = hasMore ? results.slice(0, limit) : results

	let nextCursor: string | null = null
	if (hasMore && data.length > 0) {
		const lastItem = data[data.length - 1]
		if (sort === 'popular') {
			nextCursor = buildPopularCursor(lastItem.hatenaBookmarkCount ?? 0, lastItem.publishedAt)
		} else {
			nextCursor = lastItem.publishedAt.toISOString()
		}
	}

	return {
		data,
		meta: { nextCursor, hasMore },
	}
}
