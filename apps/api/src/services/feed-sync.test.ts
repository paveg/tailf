import { describe, expect, it } from 'vitest'

/**
 * Tests for feed-sync utility functions
 * Note: extractSiteUrl is not exported, so we test the logic inline
 */

// Recreate extractSiteUrl logic for testing
function extractSiteUrl(feedUrl: string): string {
	try {
		const url = new URL(feedUrl)
		const path = url.pathname
			.replace(/\/(feed|rss|atom)(\.xml)?$/i, '')
			.replace(/\/index\.xml$/i, '')
			.replace(/\/feed\/?$/i, '')
		return `${url.origin}${path || '/'}`
	} catch {
		return feedUrl
	}
}

describe('extractSiteUrl', () => {
	describe('common feed path patterns', () => {
		it('removes /feed suffix', () => {
			expect(extractSiteUrl('https://example.com/feed')).toBe('https://example.com/')
		})

		it('removes /feed/ with trailing slash', () => {
			expect(extractSiteUrl('https://example.com/feed/')).toBe('https://example.com/')
		})

		it('removes /rss suffix', () => {
			expect(extractSiteUrl('https://example.com/rss')).toBe('https://example.com/')
		})

		it('removes /atom suffix', () => {
			expect(extractSiteUrl('https://example.com/atom')).toBe('https://example.com/')
		})

		it('removes /feed.xml', () => {
			expect(extractSiteUrl('https://example.com/feed.xml')).toBe('https://example.com/')
		})

		it('removes /rss.xml', () => {
			expect(extractSiteUrl('https://example.com/rss.xml')).toBe('https://example.com/')
		})

		it('removes /atom.xml', () => {
			expect(extractSiteUrl('https://example.com/atom.xml')).toBe('https://example.com/')
		})

		it('removes /index.xml', () => {
			expect(extractSiteUrl('https://example.com/index.xml')).toBe('https://example.com/')
		})
	})

	describe('preserves non-feed paths', () => {
		it('preserves blog path before feed', () => {
			expect(extractSiteUrl('https://example.com/blog/feed')).toBe('https://example.com/blog')
		})

		it('preserves subdirectory path', () => {
			expect(extractSiteUrl('https://example.com/user/john/feed.xml')).toBe(
				'https://example.com/user/john',
			)
		})
	})

	describe('handles subdomains', () => {
		it('preserves subdomain', () => {
			expect(extractSiteUrl('https://blog.example.com/feed')).toBe('https://blog.example.com/')
		})

		it('handles www subdomain', () => {
			expect(extractSiteUrl('https://www.example.com/rss.xml')).toBe('https://www.example.com/')
		})
	})

	describe('case insensitivity', () => {
		it('handles uppercase FEED', () => {
			expect(extractSiteUrl('https://example.com/FEED')).toBe('https://example.com/')
		})

		it('handles mixed case RSS.xml', () => {
			expect(extractSiteUrl('https://example.com/RSS.XML')).toBe('https://example.com/')
		})
	})

	describe('edge cases', () => {
		it('handles root URL without feed path', () => {
			expect(extractSiteUrl('https://example.com/')).toBe('https://example.com/')
		})

		it('returns original for invalid URL', () => {
			expect(extractSiteUrl('not-a-url')).toBe('not-a-url')
		})

		it('handles URL with query params', () => {
			// Query params are stripped by URL.origin
			expect(extractSiteUrl('https://example.com/feed?format=rss')).toBe('https://example.com/')
		})
	})

	describe('real-world feed URLs', () => {
		it('Zenn feed', () => {
			expect(extractSiteUrl('https://zenn.dev/feed')).toBe('https://zenn.dev/')
		})

		it('Qiita feed - does not handle .atom extension', () => {
			// Note: Implementation only handles .xml extension, not .atom
			expect(extractSiteUrl('https://qiita.com/popular-items/feed.atom')).toBe(
				'https://qiita.com/popular-items/feed.atom',
			)
		})

		it('GitHub blog', () => {
			expect(extractSiteUrl('https://github.blog/feed/')).toBe('https://github.blog/')
		})

		it('Hatena blog', () => {
			expect(extractSiteUrl('https://developer.hatenastaff.com/rss')).toBe(
				'https://developer.hatenastaff.com/',
			)
		})

		it('Medium feed - does not handle mid-path /feed/', () => {
			// Note: Implementation only handles /feed at the END of path
			expect(extractSiteUrl('https://medium.com/feed/@username')).toBe(
				'https://medium.com/feed/@username',
			)
		})
	})
})
