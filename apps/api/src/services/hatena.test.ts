import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getBookmarkCount, getBookmarkCounts } from './hatena'

describe('Hatena Bookmark Service', () => {
	const originalFetch = globalThis.fetch

	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		globalThis.fetch = originalFetch
		vi.useRealTimers()
	})

	describe('getBookmarkCount', () => {
		it('returns bookmark count on successful response', async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(42),
			})

			const count = await getBookmarkCount('https://example.com/article')

			expect(count).toBe(42)
			expect(fetch).toHaveBeenCalledWith(
				'https://bookmark.hatenaapis.com/count/entry?url=https%3A%2F%2Fexample.com%2Farticle',
			)
		})

		it('returns 0 when API returns non-number', async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve('invalid'),
			})

			const count = await getBookmarkCount('https://example.com')

			expect(count).toBe(0)
		})

		it('returns 0 on HTTP error', async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: false,
				status: 500,
			})

			const count = await getBookmarkCount('https://example.com')

			expect(count).toBe(0)
		})

		it('returns 0 on network error', async () => {
			globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

			const count = await getBookmarkCount('https://example.com')

			expect(count).toBe(0)
		})

		it('properly encodes URL with special characters', async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(10),
			})

			await getBookmarkCount('https://example.com/path?query=foo&bar=baz')

			expect(fetch).toHaveBeenCalledWith(
				'https://bookmark.hatenaapis.com/count/entry?url=https%3A%2F%2Fexample.com%2Fpath%3Fquery%3Dfoo%26bar%3Dbaz',
			)
		})

		it('handles Japanese URLs', async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(100),
			})

			const count = await getBookmarkCount('https://example.com/記事/テスト')

			expect(count).toBe(100)
			expect(fetch).toHaveBeenCalled()
		})
	})

	describe('getBookmarkCounts', () => {
		it('returns counts for multiple URLs', async () => {
			let callCount = 0
			globalThis.fetch = vi.fn().mockImplementation(() => {
				callCount++
				return Promise.resolve({
					ok: true,
					json: () => Promise.resolve(callCount * 10),
				})
			})

			const urls = ['https://example.com/1', 'https://example.com/2', 'https://example.com/3']

			const countsPromise = getBookmarkCounts(urls, 0) // No delay for faster test
			const counts = await countsPromise

			expect(counts.size).toBe(3)
			expect(counts.get('https://example.com/1')).toBe(10)
			expect(counts.get('https://example.com/2')).toBe(20)
			expect(counts.get('https://example.com/3')).toBe(30)
		})

		it('returns empty map for empty array', async () => {
			globalThis.fetch = vi.fn()

			const counts = await getBookmarkCounts([])

			expect(counts.size).toBe(0)
			expect(fetch).not.toHaveBeenCalled()
		})

		it('handles mixed success and failure', async () => {
			let callCount = 0
			globalThis.fetch = vi.fn().mockImplementation(() => {
				callCount++
				if (callCount === 2) {
					return Promise.resolve({ ok: false, status: 500 })
				}
				return Promise.resolve({
					ok: true,
					json: () => Promise.resolve(callCount * 10),
				})
			})

			const urls = ['https://example.com/1', 'https://example.com/2', 'https://example.com/3']
			const counts = await getBookmarkCounts(urls, 0)

			expect(counts.get('https://example.com/1')).toBe(10)
			expect(counts.get('https://example.com/2')).toBe(0) // Failed
			expect(counts.get('https://example.com/3')).toBe(30)
		})
	})
})
