import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Env } from '..'
import { createDb, type Database } from '../db'
import { fetchAndParseFeed } from '../services/rss'
import { feedsRoute } from './feeds'

vi.mock('../middleware/auth', () => ({
	requireAuth: async (
		c: { set: (key: string, value: string) => void },
		next: () => Promise<void>,
	) => {
		c.set('userId', 'user-1')
		await next()
	},
}))

vi.mock('../services/rss', () => ({ fetchAndParseFeed: vi.fn() }))

vi.mock('../services/tech-score', () => ({
	embedAndScoreBatch: async (_ai: unknown, items: unknown[]) =>
		items.map(() => ({ techScore: 0.5, embedding: null })),
}))

type Statement = { sql: string; params: unknown[] }

const THUMBNAIL = 'https://ex.com/a.png'

/** Fake D1 that records statements with their bound params; `feedRow` answers the feeds lookup. */
function createFakeD1(feedRow: unknown[] | null) {
	const statements: Statement[] = []
	const prepare = (sql: string) => {
		const statement: Statement = { sql, params: [] }
		statements.push(statement)
		const stmt = {
			bind: (...bound: unknown[]) => {
				statement.params = bound
				return stmt
			},
			all: async () => ({ results: [] }),
			first: async () => null,
			run: async () => ({ success: true }),
			raw: async () =>
				feedRow && /^select "id", "title"/i.test(sql) && !/json/i.test(sql) ? [feedRow] : [],
		}
		return stmt
	}
	const d1 = {
		prepare,
		batch: async (stmts: unknown[]) => stmts.map(() => ({ success: true, results: [] })),
	}
	return { d1: d1 as unknown as D1Database, statements }
}

function makeApp(d1: D1Database) {
	const db = createDb(d1)
	const app = new Hono<{ Bindings: Env; Variables: { db: Database } }>()
	app.use('*', async (c, next) => {
		c.set('db', db)
		await next()
	})
	app.route('/api/feeds', feedsRoute)
	return app
}

const postInserts = (statements: Statement[]) =>
	statements.filter(({ sql }) => /^insert into "posts"/i.test(sql))
const postThumbnailWrites = (statements: Statement[]) =>
	statements.filter(({ sql }) => /^update "posts"/i.test(sql))

/** Value inserted for `column`: the bound param, or null when drizzle inlined a `null` literal. */
function insertedValue({ sql, params }: Statement, column: string) {
	const [columnList, valueList] = [...sql.matchAll(/\(([^)]*)\)/g)].map((m) => m[1])
	const index = columnList.split(',').findIndex((name) => name.trim() === `"${column}"`)
	const placeholder = valueList.split(',')[index].trim()
	if (placeholder === 'null') return null
	const paramIndex = valueList
		.split(',')
		.slice(0, index)
		.filter((value) => value.trim() === '?').length
	return params[paramIndex]
}

function jsonRequest(method: string, body: unknown) {
	return {
		method,
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	}
}

describe('POST /api/feeds useImages', () => {
	beforeEach(() => {
		vi.mocked(fetchAndParseFeed).mockResolvedValue({
			title: 'Feed',
			link: 'https://ex.com',
			items: [{ title: 'A', link: 'https://ex.com/a', thumbnail: THUMBNAIL }],
		})
	})

	const register = async (body: Record<string, unknown>) => {
		const { d1, statements } = createFakeD1(null)
		const res = await makeApp(d1).request(
			'/api/feeds',
			jsonRequest('POST', { feedUrl: 'https://ex.com/feed.xml', ...body }),
			{} as Env,
		)
		return { res, statements }
	}

	it('U1: stores the enclosure thumbnail when useImages is omitted', async () => {
		const { res, statements } = await register({})

		expect(res.status).toBe(200)
		const inserts = postInserts(statements)
		expect(inserts).toHaveLength(1)
		expect(insertedValue(inserts[0], 'thumbnail_url')).toBe(THUMBNAIL)
	})

	it('U2: stores no thumbnail when useImages is false', async () => {
		const { res, statements } = await register({ useImages: false })

		expect(res.status).toBe(200)
		const inserts = postInserts(statements)
		expect(inserts).toHaveLength(1)
		expect(insertedValue(inserts[0], 'thumbnail_url')).toBeNull()
	})

	it('U3: persists use_images = false on the new feed', async () => {
		const { statements } = await register({ useImages: false })

		const feedInsert = statements.find(({ sql }) => /^insert into "feeds"/i.test(sql))
		expect(feedInsert).toBeDefined()
		expect(insertedValue(feedInsert as Statement, 'use_images')).toBe(0)
	})

	it('U4: rejects a non-boolean useImages', async () => {
		const { res, statements } = await register({ useImages: 'no' })

		expect(res.status).toBe(400)
		expect(statements).toHaveLength(0)
	})
})

describe('PATCH /api/feeds/:id useImages', () => {
	// id, title, description, feedUrl, siteUrl, type, isOfficial, useImages, bookmarkCount, lastFetchedAt, authorId, createdAt, updatedAt
	const feedRow = (useImages: 0 | 1, authorId = 'user-1') => [
		'f1',
		'Feed',
		null,
		'https://ex.com/feed.xml',
		'https://ex.com',
		'blog',
		0,
		useImages,
		0,
		null,
		authorId,
		0,
		0,
	]

	const patch = async (stored: 0 | 1, body: Record<string, unknown>, authorId?: string) => {
		const { d1, statements } = createFakeD1(feedRow(stored, authorId))
		const res = await makeApp(d1).request('/api/feeds/f1', jsonRequest('PATCH', body), {} as Env)
		return { res, statements }
	}

	it('U5: clears existing thumbnails when useImages goes true -> false', async () => {
		const { res, statements } = await patch(1, { useImages: false })

		expect(res.status).toBe(200)
		const writes = postThumbnailWrites(statements)
		expect(writes).toHaveLength(1)
		expect(writes[0].params).toEqual([null, 'f1'])
	})

	it('U6: keeps thumbnails when useImages goes false -> true', async () => {
		const { res, statements } = await patch(0, { useImages: true })

		expect(res.status).toBe(200)
		expect(postThumbnailWrites(statements)).toHaveLength(0)
		const feedUpdate = statements.find(({ sql }) => /^update "feeds"/i.test(sql))
		expect(feedUpdate?.sql).toContain('"use_images"')
	})

	it('U7: does not touch thumbnails when useImages stays false', async () => {
		const { statements } = await patch(0, { useImages: false })

		expect(postThumbnailWrites(statements)).toHaveLength(0)
	})

	it('U11: does not touch thumbnails when useImages stays true', async () => {
		const { statements } = await patch(1, { useImages: true })

		expect(postThumbnailWrites(statements)).toHaveLength(0)
	})

	it('U8: does not touch thumbnails when useImages is omitted', async () => {
		const { statements } = await patch(1, { title: 'New' })

		expect(postThumbnailWrites(statements)).toHaveLength(0)
		const feedUpdate = statements.find(({ sql }) => /^update "feeds"/i.test(sql))
		expect(feedUpdate?.sql).not.toContain('"use_images"')
	})

	it('U9: rejects non-owners without writing', async () => {
		const { res, statements } = await patch(1, { useImages: false }, 'someone-else')

		expect(res.status).toBe(403)
		expect(statements.some(({ sql }) => /^update/i.test(sql))).toBe(false)
	})

	it('U10: rejects a non-boolean useImages', async () => {
		const { res } = await patch(1, { useImages: 'false' })

		expect(res.status).toBe(400)
	})
})
