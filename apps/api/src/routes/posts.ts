import { vValidator } from '@hono/valibot-validator'
import { cursorPaginationQuerySchema } from '@tailf/shared'
import { and, desc, eq, gt, gte, inArray, like, lt, or, type SQL, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import * as v from 'valibot'
import type { Env } from '..'
import type { Database } from '../db'
import { feeds, posts } from '../db/schema'
import { parsePopularCursor } from '../utils/cursor'
import { getThreshold } from '../utils/date'
import { buildCursorResponse } from '../utils/pagination'

// Tech filter threshold
// 0.65+ = programming/dev articles, 0.55-0.65 = gadget reviews, <0.55 = non-tech
const TECH_SCORE_THRESHOLD = 0.65

// Extended schema with techOnly, official, and sort filters
const postsQuerySchema = v.object({
	...cursorPaginationQuerySchema.entries,
	techOnly: v.optional(
		v.pipe(
			v.string(),
			v.transform((s) => s === 'true'),
		),
	),
	official: v.optional(
		v.pipe(
			v.string(),
			v.transform((s) => s === 'true'),
		),
	),
	sort: v.optional(v.picklist(['recent', 'popular']), 'recent'),
})

/**
 * Get feed IDs filtered by official status
 */
async function getOfficialFeedIds(db: Database, official: boolean): Promise<string[]> {
	const officialFeeds = await db.query.feeds.findMany({
		where: eq(feeds.isOfficial, official),
		columns: { id: true },
	})
	return officialFeeds.map((f) => f.id)
}

type Variables = {
	db: Database
}

export const postsRoute = new Hono<{ Bindings: Env; Variables: Variables }>()

// Get latest posts (timeline) - cursor-based pagination
postsRoute.get('/', vValidator('query', postsQuerySchema), async (c) => {
	const { cursor, limit, techOnly, official, sort } = c.req.valid('query')
	const db = c.get('db')

	// Cursor condition depends on sort type
	let cursorCondition: SQL | undefined
	if (cursor) {
		if (sort === 'popular') {
			const { count, date } = parsePopularCursor(cursor)
			// Posts with lower bookmark count, or same count but older
			cursorCondition = or(
				lt(posts.hatenaBookmarkCount, count),
				and(eq(posts.hatenaBookmarkCount, count), lt(posts.publishedAt, date)),
			)
		} else {
			cursorCondition = lt(posts.publishedAt, new Date(cursor))
		}
	}
	const techCondition = techOnly ? gte(posts.techScore, TECH_SCORE_THRESHOLD) : undefined

	// Official filter: get feed IDs first, then filter posts
	let officialCondition: SQL | undefined
	if (official !== undefined) {
		const feedIds = await getOfficialFeedIds(db, official)
		if (feedIds.length > 0) {
			officialCondition = inArray(posts.feedId, feedIds)
		} else {
			// No matching feeds, return empty
			return c.json(buildCursorResponse([], limit))
		}
	}

	const conditions = [cursorCondition, techCondition, officialCondition].filter(Boolean)

	// Order by sort type
	const orderBy =
		sort === 'popular'
			? [desc(posts.hatenaBookmarkCount), desc(posts.publishedAt)]
			: [desc(posts.publishedAt)]

	const result = await db.query.posts.findMany({
		where: conditions.length > 0 ? and(...conditions) : undefined,
		limit: limit + 1,
		orderBy,
		with: { feed: { with: { author: true } } },
	})

	return c.json(buildCursorResponse(result, limit, sort))
})

// Minimum query length for FTS5 trigram search (3 characters required)
const FTS5_MIN_QUERY_LENGTH = 3

/**
 * Build search response with query in meta
 */
function buildSearchResponse<T extends { publishedAt: Date }>(
	results: T[],
	limit: number,
	query: string,
): ReturnType<typeof buildCursorResponse<T>> & { meta: { query: string } } {
	const response = buildCursorResponse(results, limit)
	return {
		...response,
		meta: { ...response.meta, query },
	}
}

/**
 * Build SQL IN clause from array of values
 */
function buildSqlInClause(values: string[]): ReturnType<typeof sql> {
	return sql.join(
		values.map((v) => sql`${v}`),
		sql`, `,
	)
}

// Search posts - cursor-based pagination using FTS5 (with LIKE fallback for short queries)
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
		const { q, cursor, limit, techOnly, official } = c.req.valid('query')
		const db = c.get('db')

		// Official filter - resolve feed IDs upfront
		let officialFeedIds: string[] | undefined
		if (official !== undefined) {
			officialFeedIds = await getOfficialFeedIds(db, official)
			if (officialFeedIds.length === 0) {
				return c.json(buildSearchResponse([], limit, q))
			}
		}

		// Use FTS5 for queries with 3+ characters, LIKE for shorter ones
		const useFts = q.length >= FTS5_MIN_QUERY_LENGTH

		if (useFts) {
			const cursorCondition = cursor
				? sql`AND p.published_at < ${new Date(cursor).getTime()}`
				: sql``
			const techCondition = techOnly ? sql`AND p.tech_score >= ${TECH_SCORE_THRESHOLD}` : sql``
			const officialCondition = officialFeedIds
				? sql`AND p.feed_id IN (${buildSqlInClause(officialFeedIds)})`
				: sql``

			const ftsResult = await db.all<{ id: string }>(sql`
				SELECT p.id FROM posts p
				JOIN posts_fts ON p.rowid = posts_fts.rowid
				WHERE posts_fts MATCH ${q}
				${cursorCondition}
				${techCondition}
				${officialCondition}
				ORDER BY p.published_at DESC
				LIMIT ${limit + 1}
			`)

			const matchedIds = ftsResult.map((r) => r.id)
			if (matchedIds.length === 0) {
				return c.json(buildSearchResponse([], limit, q))
			}

			const result = await db.query.posts.findMany({
				where: inArray(posts.id, matchedIds),
				orderBy: [desc(posts.publishedAt)],
				with: { feed: { with: { author: true } } },
			})
			return c.json(buildSearchResponse(result, limit, q))
		}

		// LIKE fallback for short queries (< 3 chars)
		const searchTerm = `%${q}%`
		const conditions = [
			or(like(posts.title, searchTerm), like(posts.summary, searchTerm)),
			cursor ? lt(posts.publishedAt, new Date(cursor)) : undefined,
			techOnly ? gte(posts.techScore, TECH_SCORE_THRESHOLD) : undefined,
			officialFeedIds ? inArray(posts.feedId, officialFeedIds) : undefined,
		].filter(Boolean)

		const result = await db.query.posts.findMany({
			where: conditions.length > 0 ? and(...conditions) : undefined,
			limit: limit + 1,
			orderBy: [desc(posts.publishedAt)],
			with: { feed: { with: { author: true } } },
		})
		return c.json(buildSearchResponse(result, limit, q))
	},
)

// Get popular posts by Hatena Bookmark count
postsRoute.get(
	'/ranking',
	vValidator(
		'query',
		v.object({
			period: v.optional(v.picklist(['week', 'month']), 'week'),
			limit: v.optional(v.pipe(v.string(), v.transform(Number)), '20'),
			techOnly: v.optional(
				v.pipe(
					v.string(),
					v.transform((s) => s === 'true'),
				),
			),
		}),
	),
	async (c) => {
		const { period: requestedPeriod, limit, techOnly } = c.req.valid('query')
		const db = c.get('db')

		const techCondition = techOnly ? gte(posts.techScore, TECH_SCORE_THRESHOLD) : undefined
		const bookmarkCondition = gt(posts.hatenaBookmarkCount, 0)

		// Helper to fetch ranking for a given period
		const fetchRanking = async (period: 'week' | 'month') => {
			const threshold = getThreshold(period)
			const dateCondition = gte(posts.publishedAt, threshold)
			const conditions = [dateCondition, bookmarkCondition, techCondition].filter(Boolean)

			return db.query.posts.findMany({
				where: and(...conditions),
				limit,
				orderBy: [desc(posts.hatenaBookmarkCount), desc(posts.publishedAt)],
				with: { feed: { with: { author: true } } },
			})
		}

		// Try requested period first
		let result = await fetchRanking(requestedPeriod)
		let actualPeriod = requestedPeriod

		// Fallback: if week returns empty, try month
		if (result.length === 0 && requestedPeriod === 'week') {
			result = await fetchRanking('month')
			actualPeriod = 'month'
		}

		return c.json({
			data: result,
			meta: {
				period: actualPeriod,
				requestedPeriod,
				fallback: actualPeriod !== requestedPeriod,
			},
		})
	},
)
