import { afterEach, describe, expect, it, vi } from 'vitest'
import { safeFetchExternal } from './safe-fetch'

/**
 * Tests for the SSRF + response-size hardened external fetch wrapper.
 *
 * Cloudflare Workers' fetch follows redirects by default and reads bodies
 * unbounded, so a malicious feed could redirect into a private network or
 * return a multi-GB body to drain the worker. safeFetchExternal blocks
 * those paths.
 */

function makeStreamingResponse(
	chunks: Uint8Array[],
	init?: { status?: number; headers?: Record<string, string> },
): Response {
	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			for (const chunk of chunks) controller.enqueue(chunk)
			controller.close()
		},
	})
	return new Response(stream, init)
}

afterEach(() => {
	vi.restoreAllMocks()
})

describe('safeFetchExternal', () => {
	it('returns body for an allowed https URL', async () => {
		const fetchSpy = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValue(new Response('<rss>ok</rss>', { status: 200 }))
		const result = await safeFetchExternal('https://example.com/feed.xml')
		expect(result).toBe('<rss>ok</rss>')
		expect(fetchSpy).toHaveBeenCalledOnce()
	})

	it('rejects non-http(s) scheme without calling fetch', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch')
		const result = await safeFetchExternal('javascript:alert(1)')
		expect(result).toBeNull()
		expect(fetchSpy).not.toHaveBeenCalled()
	})

	it('rejects private hostname without calling fetch', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch')
		const result = await safeFetchExternal('http://127.0.0.1/admin')
		expect(result).toBeNull()
		expect(fetchSpy).not.toHaveBeenCalled()
	})

	it('does NOT auto-follow redirects (uses redirect: manual)', async () => {
		vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (input, init) => {
			const opts = init as RequestInit | undefined
			expect(opts?.redirect).toBe('manual')
			return new Response('', { status: 302, headers: { location: 'http://127.0.0.1/internal' } })
		})
		const result = await safeFetchExternal('https://example.com/feed.xml')
		expect(result).toBeNull()
	})

	it('rejects redirect to private hostname even when public URL was supplied', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
			new Response('', { status: 302, headers: { location: 'http://[::1]/secret' } }),
		)
		const result = await safeFetchExternal('https://example.com/feed.xml')
		expect(result).toBeNull()
	})

	it('follows a redirect to a public URL and re-validates each hop', async () => {
		const fetchSpy = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(
				new Response('', {
					status: 301,
					headers: { location: 'https://other.example.com/feed.xml' },
				}),
			)
			.mockResolvedValueOnce(new Response('<rss>final</rss>', { status: 200 }))
		const result = await safeFetchExternal('https://example.com/feed.xml')
		expect(result).toBe('<rss>final</rss>')
		expect(fetchSpy).toHaveBeenCalledTimes(2)
	})

	it('rejects a redirect chain longer than the cap', async () => {
		const spy = vi.spyOn(globalThis, 'fetch')
		for (let i = 0; i < 10; i++) {
			spy.mockResolvedValueOnce(
				new Response('', {
					status: 302,
					headers: { location: `https://hop${i + 1}.example.com/feed` },
				}),
			)
		}
		const result = await safeFetchExternal('https://hop0.example.com/feed')
		expect(result).toBeNull()
	})

	it('rejects a response whose Content-Length exceeds the cap', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response('ignored', {
				status: 200,
				headers: { 'content-length': String(50 * 1024 * 1024) },
			}),
		)
		const result = await safeFetchExternal('https://example.com/feed.xml')
		expect(result).toBeNull()
	})

	it('aborts when streamed body exceeds the cap mid-flight', async () => {
		const oneMB = new Uint8Array(1024 * 1024)
		const tenChunks = Array.from({ length: 10 }, () => oneMB)
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeStreamingResponse(tenChunks))
		const result = await safeFetchExternal('https://example.com/feed.xml')
		expect(result).toBeNull()
	})

	it('returns null for non-2xx responses', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 500 }))
		const result = await safeFetchExternal('https://example.com/feed.xml')
		expect(result).toBeNull()
	})

	it('passes the User-Agent header', async () => {
		const fetchSpy = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValue(new Response('ok', { status: 200 }))
		await safeFetchExternal('https://example.com/feed.xml')
		const init = fetchSpy.mock.calls[0]?.[1] as RequestInit | undefined
		const headers = init?.headers as Record<string, string> | undefined
		expect(headers?.['User-Agent']).toMatch(/tailf/i)
	})
})
