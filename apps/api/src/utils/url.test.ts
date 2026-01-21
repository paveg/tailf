import { describe, expect, it } from 'vitest'
import { normalizeUrl } from './url'

describe('normalizeUrl', () => {
	describe('protocol handling', () => {
		it('adds https:// when missing', () => {
			expect(normalizeUrl('example.com')).toBe('https://example.com/')
		})

		it('preserves existing https://', () => {
			expect(normalizeUrl('https://example.com')).toBe('https://example.com/')
		})

		it('converts http:// to https://', () => {
			// Note: current implementation keeps the protocol, let's test actual behavior
			const result = normalizeUrl('http://example.com')
			expect(result).toBe('https://example.com/')
		})

		it('handles HTTPS in uppercase', () => {
			expect(normalizeUrl('HTTPS://Example.com')).toBe('https://example.com/')
		})
	})

	describe('www removal', () => {
		it('removes www. prefix', () => {
			expect(normalizeUrl('https://www.example.com')).toBe('https://example.com/')
		})

		it('removes www. without protocol', () => {
			expect(normalizeUrl('www.example.com')).toBe('https://example.com/')
		})

		it('does not remove www from subdomain', () => {
			expect(normalizeUrl('https://wwwexample.com')).toBe('https://wwwexample.com/')
		})
	})

	describe('hostname normalization', () => {
		it('converts hostname to lowercase', () => {
			expect(normalizeUrl('https://EXAMPLE.COM')).toBe('https://example.com/')
		})

		it('handles mixed case', () => {
			expect(normalizeUrl('https://ExAmPlE.cOm')).toBe('https://example.com/')
		})
	})

	describe('trailing slash handling', () => {
		it('keeps trailing slash for root path', () => {
			expect(normalizeUrl('https://example.com/')).toBe('https://example.com/')
		})

		it('removes trailing slash from paths', () => {
			expect(normalizeUrl('https://example.com/blog/')).toBe('https://example.com/blog')
		})

		it('removes trailing slash from deep paths', () => {
			expect(normalizeUrl('https://example.com/a/b/c/')).toBe('https://example.com/a/b/c')
		})

		it('preserves path without trailing slash', () => {
			expect(normalizeUrl('https://example.com/blog')).toBe('https://example.com/blog')
		})
	})

	describe('query string handling', () => {
		it('preserves query strings', () => {
			expect(normalizeUrl('https://example.com?foo=bar')).toBe('https://example.com/?foo=bar')
		})

		it('preserves query strings with path', () => {
			expect(normalizeUrl('https://example.com/path?foo=bar')).toBe(
				'https://example.com/path?foo=bar',
			)
		})
	})

	describe('whitespace handling', () => {
		it('trims leading whitespace', () => {
			expect(normalizeUrl('  https://example.com')).toBe('https://example.com/')
		})

		it('trims trailing whitespace', () => {
			expect(normalizeUrl('https://example.com  ')).toBe('https://example.com/')
		})

		it('trims both ends', () => {
			expect(normalizeUrl('  https://example.com  ')).toBe('https://example.com/')
		})
	})

	describe('edge cases', () => {
		it('handles subdomains correctly', () => {
			expect(normalizeUrl('https://blog.example.com')).toBe('https://blog.example.com/')
		})

		it('strips ports (uses hostname not host)', () => {
			// Note: Implementation uses hostname which excludes port
			expect(normalizeUrl('https://example.com:8080')).toBe('https://example.com/')
		})

		it('handles file extensions in path', () => {
			expect(normalizeUrl('https://example.com/feed.xml')).toBe('https://example.com/feed.xml')
		})

		it('returns input for invalid URLs', () => {
			// Invalid URL should return the normalized input with https://
			const result = normalizeUrl('not a valid url with spaces')
			expect(result).toBe('https://not a valid url with spaces')
		})
	})

	describe('real-world RSS feed URLs', () => {
		it('normalizes Zenn feed URL', () => {
			expect(normalizeUrl('https://zenn.dev/feed')).toBe('https://zenn.dev/feed')
		})

		it('normalizes Qiita feed URL', () => {
			expect(normalizeUrl('https://qiita.com/popular-items/feed.atom')).toBe(
				'https://qiita.com/popular-items/feed.atom',
			)
		})

		it('normalizes personal blog with www', () => {
			expect(normalizeUrl('https://www.example-blog.com/feed/')).toBe(
				'https://example-blog.com/feed',
			)
		})

		it('normalizes GitHub blog', () => {
			expect(normalizeUrl('https://github.blog/feed/')).toBe('https://github.blog/feed')
		})
	})
})
