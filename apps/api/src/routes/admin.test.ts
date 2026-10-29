import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Env } from '..'
import { createDb, type Database } from '../db'
import { safeFetchExternal } from '../services/safe-fetch'
import { adminRoute } from './admin'

vi.mock('../services/safe-fetch', () => ({ safeFetchExternal: vi.fn() }))

type Statement = { sql: string; params: unknown[] }

function createFakeD1(respond: (sql: string) => unknown[][] = () => []) {
	const statements: Statement[] = []
	const d1 = {
		prepare(sql: string) {
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
				raw: async () => respond(sql),
			}
			return stmt
		},
	}
	return { d1: d1 as unknown as D1Database, statements }
}

describe('POST /admin/posts/resync-thumbnails', () => {
	it('A1: only considers posts of feeds that use images', async () => {
		const { d1, statements } = createFakeD1()
		const app = new Hono<{ Bindings: Env; Variables: { db: Database } }>()
		app.use('*', async (c, next) => {
			c.set('db', createDb(d1))
			await next()
		})
		app.route('/admin', adminRoute)

		const res = await app.request(
			'/admin/posts/resync-thumbnails',
			{ method: 'POST', headers: { Authorization: 'Bearer secret' } },
			{ ADMIN_SECRET: 'secret' } as Env,
		)

		expect(res.status).toBe(200)
		const candidateQuery = statements.find(({ sql }) => /from "posts"/i.test(sql))
		expect(candidateQuery?.sql).toMatch(/"thumbnail_url" is null/i)
		expect(candidateQuery?.sql).toMatch(
			/"feed_id" in \(select "id" from "feeds" where "feeds"\."use_images" = \?\)/i,
		)
		expect(candidateQuery?.params).toEqual([1])
	})
})

describe('POST /admin/posts/resync-thumbnails writes', () => {
	const ARTICLE = 'https://ex.com/a'
	const FEED = 'https://ex.com/feed'
	const OG_PAGE = '<meta property="og:image" content="https://ex.com/og.png">'

	beforeEach(() => {
		vi.mocked(safeFetchExternal).mockReset()
	})

	async function resync(feedXml: string) {
		vi.mocked(safeFetchExternal).mockImplementation(async (url) =>
			url === FEED ? feedXml : OG_PAGE,
		)
		const { d1, statements } = createFakeD1((sql) => {
			if (/from "posts"/i.test(sql)) return [['p1', ARTICLE, 'f1']]
			if (/from "feeds"/i.test(sql)) return [['f1', FEED]]
			return []
		})
		const app = new Hono<{ Bindings: Env; Variables: { db: Database } }>()
		app.use('*', async (c, next) => {
			c.set('db', createDb(d1))
			await next()
		})
		app.route('/admin', adminRoute)
		const res = await app.request(
			'/admin/posts/resync-thumbnails',
			{ method: 'POST', headers: { Authorization: 'Bearer secret' } },
			{ ADMIN_SECRET: 'secret' } as Env,
		)
		return { res, statements }
	}

	const thumbnailUpdates = (statements: Statement[]) =>
		statements.filter(({ sql }) => /^update "posts"/i.test(sql))

	function expectGuardedByCurrentFlag({ sql, params }: Statement) {
		expect(sql).toMatch(
			/"feed_id" in \(select "id" from "feeds" where "feeds"\."use_images" = \?\)/i,
		)
		expect(params.at(-1)).toBe(1)
	}

	it('A2: the RSS-phase thumbnail write only applies while the feed still uses images', async () => {
		const { res, statements } = await resync(
			`<rss><channel><title>F</title><item><title>t</title><link>${ARTICLE}</link><media:thumbnail url="${ARTICLE}.png"/></item></channel></rss>`,
		)

		expect(res.status).toBe(200)
		const updates = thumbnailUpdates(statements)
		expect(updates).toHaveLength(1)
		expect(updates[0].params).toContain(`${ARTICLE}.png`)
		expectGuardedByCurrentFlag(updates[0])
	})

	it('A3: the OGP-phase thumbnail write only applies while the feed still uses images', async () => {
		const { res, statements } = await resync(
			`<rss><channel><title>F</title><item><title>t</title><link>${ARTICLE}</link></item></channel></rss>`,
		)

		expect(res.status).toBe(200)
		const updates = thumbnailUpdates(statements)
		expect(updates).toHaveLength(1)
		expect(updates[0].params).toContain('https://ex.com/og.png')
		expectGuardedByCurrentFlag(updates[0])
	})
})
