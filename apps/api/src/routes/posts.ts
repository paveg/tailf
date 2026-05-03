import { vValidator } from '@hono/valibot-validator'
import { cursorPaginationQuerySchema } from '@tailf/shared'
import {
	and,
	desc,
	eq,
	gt,
	gte,
	inArray,
	isNotNull,
	like,
	lt,
	notInArray,
	or,
	type SQL,
} from 'drizzle-orm'
import { Hono } from 'hono'
import * as v from 'valibot'
import type { Env } from '..'
import type { Database } from '../db'
import { feeds, posts } from '../db/schema'
import { compute, decodeEmbedding } from '../services/embedding'
import { decodeOffsetCursor, encodeOffsetCursor, rankCandidates } from '../services/semantic-search'
import { topicsToArray } from '../services/topic-assignment'
import { D1_MAX_VARIABLES, TECH_SCORE_THRESHOLD } from '../utils/constants'
import { parsePopularCursor } from '../utils/cursor'
import { getThreshold } from '../utils/date'
import { buildCursorResponse } from '../utils/pagination'

// Extended schema with techOnly, official, sort, excludeAuthorId, and topic filters
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
	excludeAuthorId: v.optional(v.string()),
	// Topic filter (single select, matches mainTopic or subTopic)
	topic: v.optional(v.string()),
})

// Use chunked queries when array might exceed D1 variable limit

/**
 * Build SQL condition for filtering by feed IDs with D1 variable limit handling
 * Uses raw SQL subquery for large sets to avoid variable limit
 */
function buildFeedIdCondition(feedIds: string[], include: boolean): SQL | undefined {
	if (feedIds.length === 0) return undefined

	// For small arrays, use inArray/notInArray directly
	if (feedIds.length <= D1_MAX_VARIABLES) {
		return include ? inArray(posts.feedId, feedIds) : notInArray(posts.feedId, feedIds)
	}

	// For large arrays, chunk the IDs and combine with OR/AND
	const chunks: SQL[] = []
	for (let i = 0; i < feedIds.length; i += D1_MAX_VARIABLES) {
		const chunk = feedIds.slice(i, i + D1_MAX_VARIABLES)
		chunks.push(include ? inArray(posts.feedId, chunk) : notInArray(posts.feedId, chunk))
	}

	// For include: OR the chunks (any match)
	// For exclude: AND the chunks (all must not match)
	return include ? or(...chunks) : and(...chunks)
}

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

/**
 * Get feed IDs owned by a specific author (for exclusion)
 */
async function getFeedIdsByAuthor(db: Database, authorId: string): Promise<string[]> {
	const authorFeeds = await db.query.feeds.findMany({
		where: eq(feeds.authorId, authorId),
		columns: { id: true },
	})
	return authorFeeds.map((f) => f.id)
}

type Variables = {
	db: Database
}

export const postsRoute = new Hono<{ Bindings: Env; Variables: Variables }>()

// Get latest posts (timeline) - cursor-based pagination
postsRoute.get('/', vValidator('query', postsQuerySchema), async (c) => {
	const { cursor, limit, techOnly, official, sort, excludeAuthorId, topic } = c.req.valid('query')
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
			officialCondition = buildFeedIdCondition(feedIds, true)
		} else {
			// No matching feeds, return empty
			return c.json(buildCursorResponse([], limit))
		}
	}

	// Exclude posts from author's own feeds
	let excludeCondition: SQL | undefined
	if (excludeAuthorId) {
		const excludeFeedIds = await getFeedIdsByAuthor(db, excludeAuthorId)
		if (excludeFeedIds.length > 0) {
			excludeCondition = buildFeedIdCondition(excludeFeedIds, false)
		}
	}

	// Topic filter: match mainTopic or subTopic
	const topicCondition = topic
		? or(eq(posts.mainTopic, topic), eq(posts.subTopic, topic))
		: undefined

	const conditions = [
		cursorCondition,
		techCondition,
		officialCondition,
		excludeCondition,
		topicCondition,
	].filter(Boolean)

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

	// Add topics array to response
	const postsWithTopics = result.map((post) => ({
		...post,
		topics: topicsToArray(post.mainTopic, post.subTopic),
	}))

	return c.json(buildCursorResponse(postsWithTopics, limit, sort))
})

/**
 * Build search response with query and mode in meta.
 * The semantic path passes overrideCursor because it computes hasMore/nextCursor
 * from offset slicing rather than from the publishedAt of the last result.
 */
function buildSearchResponse<T extends { publishedAt: Date }>(
	results: T[],
	limit: number,
	query: string,
	mode: 'semantic' | 'keyword',
	overrideCursor?: { hasMore: boolean; nextCursor: string | null },
): ReturnType<typeof buildCursorResponse<T>> & {
	meta: { query: string; mode: 'semantic' | 'keyword' }
} {
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

		// Semantic path requires a long-enough query AND a working AI binding.
		// MAX_CANDIDATES bounds memory: ~4 KB embedding × 5000 = ~20 MB BLOB plus
		// another ~20 MB of decoded Float32Arrays. Newest-first via publishedAt
		// keeps recent content in the scoring set if we ever exceed the cap.
		const MAX_CANDIDATES = 5000

		if (q.length >= 3 && ai) {
			let queryVec: Float32Array | null = null
			try {
				queryVec = await compute(ai, q)
			} catch (error) {
				console.warn('[Search] AI compute failed, falling back to keyword:', {
					q,
					errorName: (error as Error)?.constructor?.name,
					errorMessage: (error as Error)?.message,
				})
			}

			if (queryVec) {
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
					.orderBy(desc(posts.publishedAt))
					.limit(MAX_CANDIDATES)

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
		}

		// Keyword LIKE fallback (also used for q.length < 3)
		const searchTerm = `%${q}%`
		const topicCondition = topic
			? or(eq(posts.mainTopic, topic), eq(posts.subTopic, topic))
			: undefined
		const conditions = [
			or(like(posts.title, searchTerm), like(posts.summary, searchTerm)),
			(() => {
				if (!cursor) return undefined
				const date = new Date(cursor)
				if (Number.isNaN(date.getTime())) return undefined
				return lt(posts.publishedAt, date)
			})(),
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

		// Add topics array to response
		const postsWithTopics = result.map((post) => ({
			...post,
			topics: topicsToArray(post.mainTopic, post.subTopic),
		}))

		return c.json({
			data: postsWithTopics,
			meta: {
				period: actualPeriod,
				requestedPeriod,
				fallback: actualPeriod !== requestedPeriod,
			},
		})
	},
)
