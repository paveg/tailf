import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import type { Env } from '..'
import type { Database } from '../db'
import { authRoute } from './auth'

/**
 * Tests for OAuth login CSRF protection (state parameter).
 *
 * The /github endpoint must mint a random state, set it in an httpOnly
 * cookie, and forward it on the GitHub authorize URL. The /github/callback
 * endpoint must reject any request whose state query param is missing or
 * does not match the cookie, returning 400 before touching the database.
 */

type Variables = {
	db: Database
	userId: string
}

function makeApp() {
	const app = new Hono<{ Bindings: Env; Variables: Variables }>()
	// auth.ts reads c.get('db') only after the state check; provide a stub
	// so the no-DB error paths don't crash on missing context.
	app.use('*', async (c, next) => {
		c.set('db', {} as Database)
		await next()
	})
	app.route('/api/auth', authRoute)
	return app
}

const env: Partial<Env> = {
	GITHUB_CLIENT_ID: 'test-client-id',
	GITHUB_CLIENT_SECRET: 'test-secret',
	SESSION_SECRET: 'test-session',
	ENVIRONMENT: 'development',
	APP_URL: 'http://localhost:4321',
	API_URL: 'http://localhost:8788',
}

function getSetCookie(res: Response, name: string): string | null {
	for (const value of res.headers.getSetCookie()) {
		if (value.startsWith(`${name}=`)) return value
	}
	return null
}

function parseCookieValue(setCookie: string): string {
	return setCookie.split(';')[0].split('=')[1] ?? ''
}

describe('GET /api/auth/github', () => {
	it('redirects to GitHub authorize URL with state query param', async () => {
		const app = makeApp()
		const res = await app.request('/api/auth/github', {}, env)

		expect(res.status).toBe(302)
		const location = res.headers.get('location') ?? ''
		expect(location.startsWith('https://github.com/login/oauth/authorize?')).toBe(true)
		const url = new URL(location)
		const state = url.searchParams.get('state')
		expect(state).toBeTruthy()
		expect((state as string).length).toBeGreaterThanOrEqual(16)
	})

	it('sets oauth_state cookie with httpOnly and matching value', async () => {
		const app = makeApp()
		const res = await app.request('/api/auth/github', {}, env)

		const setCookie = getSetCookie(res, 'oauth_state')
		expect(setCookie).not.toBeNull()
		const cookieValue = parseCookieValue(setCookie as string)
		const url = new URL(res.headers.get('location') as string)
		expect(cookieValue).toBe(url.searchParams.get('state'))

		const lower = (setCookie as string).toLowerCase()
		expect(lower).toContain('httponly')
		expect(lower).toContain('samesite=lax')
		expect(lower).toContain('path=/')
	})

	it('uses unpredictable state values (different across requests)', async () => {
		const app = makeApp()
		const res1 = await app.request('/api/auth/github', {}, env)
		const res2 = await app.request('/api/auth/github', {}, env)
		const s1 = new URL(res1.headers.get('location') as string).searchParams.get('state')
		const s2 = new URL(res2.headers.get('location') as string).searchParams.get('state')
		expect(s1).toBeTruthy()
		expect(s2).toBeTruthy()
		expect(s1).not.toBe(s2)
	})
})

describe('GET /api/auth/github/callback', () => {
	async function expectInvalidState(res: Response) {
		expect(res.status).toBe(400)
		const body = (await res.json()) as { error?: string }
		expect(body.error).toBe('Invalid state')
	}

	it('returns 400 with Invalid state when state query param is missing', async () => {
		const app = makeApp()
		const res = await app.request(
			'/api/auth/github/callback?code=abc',
			{ headers: { cookie: 'oauth_state=anything' } },
			env,
		)
		await expectInvalidState(res)
	})

	it('returns 400 with Invalid state when oauth_state cookie is missing', async () => {
		const app = makeApp()
		const res = await app.request('/api/auth/github/callback?code=abc&state=foo', {}, env)
		await expectInvalidState(res)
	})

	it('returns 400 with Invalid state when state and cookie do not match', async () => {
		const app = makeApp()
		const res = await app.request(
			'/api/auth/github/callback?code=abc&state=foo',
			{ headers: { cookie: 'oauth_state=bar' } },
			env,
		)
		await expectInvalidState(res)
	})

	it('returns 400 No code when code is missing but state matches', async () => {
		const app = makeApp()
		const res = await app.request(
			'/api/auth/github/callback?state=foo',
			{ headers: { cookie: 'oauth_state=foo' } },
			env,
		)
		expect(res.status).toBe(400)
		const body = (await res.json()) as { error?: string }
		expect(body.error).toBe('No code provided')
	})
})
