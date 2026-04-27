import { describe, expect, it } from 'vitest'

/**
 * Tests for the API CORS allowlist.
 *
 * The previous implementation used substring matching (`origin.includes('tailf')`)
 * which permitted attacker domains like `evil-tailf.com`, `tailf.evil.example`,
 * and `localhost.evil.example`. With `credentials: true` this exposed the API
 * to origin-confusion attacks. Switch to an explicit allowlist.
 */

// We mount the app inside each test via dynamic import so the cors config
// is loaded fresh from index.ts.
async function loadApp() {
	const mod = await import('./index')
	// index.ts exports default { fetch, scheduled }; the Hono app's fetch is on .fetch.
	return mod.default as { fetch: (req: Request, env?: unknown, ctx?: unknown) => Promise<Response> }
}

async function fetchWithOrigin(origin: string | undefined, method = 'GET'): Promise<Response> {
	const app = await loadApp()
	const headers: Record<string, string> = {}
	if (origin !== undefined) headers.Origin = origin
	if (method === 'OPTIONS') {
		headers['Access-Control-Request-Method'] = 'GET'
		headers['Access-Control-Request-Headers'] = 'Content-Type'
	}
	const req = new Request('http://localhost/health', { method, headers })
	return app.fetch(req)
}

describe('CORS allowlist', () => {
	it('allows the production origin', async () => {
		const res = await fetchWithOrigin('https://tailf.pavegy.workers.dev')
		expect(res.headers.get('access-control-allow-origin')).toBe('https://tailf.pavegy.workers.dev')
	})

	it('allows the localhost web dev origin', async () => {
		const res = await fetchWithOrigin('http://localhost:4321')
		expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:4321')
	})

	it('allows the localhost api dev origin', async () => {
		const res = await fetchWithOrigin('http://localhost:8788')
		expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:8788')
	})

	it('REJECTS evil-tailf.com (substring match bypass)', async () => {
		const res = await fetchWithOrigin('https://evil-tailf.com')
		expect(res.headers.get('access-control-allow-origin')).toBeNull()
	})

	it('REJECTS tailf.evil.example (substring match bypass)', async () => {
		const res = await fetchWithOrigin('https://tailf.evil.example')
		expect(res.headers.get('access-control-allow-origin')).toBeNull()
	})

	it('REJECTS localhost.evil.example (substring match bypass)', async () => {
		const res = await fetchWithOrigin('https://localhost.evil.example')
		expect(res.headers.get('access-control-allow-origin')).toBeNull()
	})

	it('REJECTS scheme-only mismatch (http vs https on production host)', async () => {
		const res = await fetchWithOrigin('http://tailf.pavegy.workers.dev')
		expect(res.headers.get('access-control-allow-origin')).toBeNull()
	})

	it('returns Access-Control-Allow-Credentials true for allowed origins', async () => {
		const res = await fetchWithOrigin('https://tailf.pavegy.workers.dev')
		expect(res.headers.get('access-control-allow-credentials')).toBe('true')
	})

	it('handles OPTIONS preflight for allowed origin', async () => {
		const res = await fetchWithOrigin('https://tailf.pavegy.workers.dev', 'OPTIONS')
		expect(res.headers.get('access-control-allow-origin')).toBe('https://tailf.pavegy.workers.dev')
	})

	it('rejects OPTIONS preflight for disallowed origin', async () => {
		const res = await fetchWithOrigin('https://evil-tailf.com', 'OPTIONS')
		expect(res.headers.get('access-control-allow-origin')).toBeNull()
	})
})
