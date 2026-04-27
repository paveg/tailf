import { describe, expect, it } from 'vitest'
import { isAllowedExternalUrl, isPrivateHostname, normalizeUrl } from './url'

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

	describe('SpeakerDeck feed conversion', () => {
		it('converts SpeakerDeck .rss to .atom', () => {
			expect(normalizeUrl('https://speakerdeck.com/username.rss')).toBe(
				'https://speakerdeck.com/username.atom',
			)
		})

		it('keeps SpeakerDeck .atom as is', () => {
			expect(normalizeUrl('https://speakerdeck.com/username.atom')).toBe(
				'https://speakerdeck.com/username.atom',
			)
		})

		it('handles SpeakerDeck with www prefix', () => {
			expect(normalizeUrl('https://www.speakerdeck.com/username.rss')).toBe(
				'https://speakerdeck.com/username.atom',
			)
		})

		it('does not affect non-SpeakerDeck .rss URLs', () => {
			expect(normalizeUrl('https://example.com/feed.rss')).toBe('https://example.com/feed.rss')
		})
	})
})

describe('isPrivateHostname', () => {
	it.each([
		'localhost',
		'127.0.0.1',
		'127.255.255.254',
		'10.0.0.1',
		'10.255.255.255',
		'172.16.0.1',
		'172.31.255.255',
		'192.168.0.1',
		'192.168.255.255',
		'169.254.169.254',
		'0.0.0.0',
		'0',
		'2130706433',
		'0x7f000001',
		'017700000001',
		'::1',
		'[::1]',
		'::ffff:127.0.0.1',
		'[::ffff:127.0.0.1]',
		'fc00::1',
		'fd12:3456:789a::1',
		'fe80::1',
	])('rejects %s as private', (hostname) => {
		expect(isPrivateHostname(hostname)).toBe(true)
	})

	it.each([
		'example.com',
		'api.github.com',
		'tailf.pavegy.workers.dev',
		'8.8.8.8',
		'1.1.1.1',
		'172.15.0.1',
		'172.32.0.1',
		'2001:4860:4860::8888',
	])('accepts %s as public', (hostname) => {
		expect(isPrivateHostname(hostname)).toBe(false)
	})
})

describe('isAllowedExternalUrl', () => {
	it.each([
		'https://example.com/',
		'http://example.com/feed.xml',
	])('allows public http(s) %s', (url) => {
		expect(isAllowedExternalUrl(url)).toBe(true)
	})

	it.each([
		'javascript:alert(1)',
		'data:text/html,<script>alert(1)</script>',
		'file:///etc/passwd',
		'gopher://example.com/',
		'ftp://example.com/',
	])('rejects non-http(s) scheme %s', (url) => {
		expect(isAllowedExternalUrl(url)).toBe(false)
	})

	it.each([
		'http://127.0.0.1/',
		'http://localhost/admin',
		'http://[::1]/',
		'http://10.0.0.1/',
		'http://169.254.169.254/latest/meta-data/',
		'http://2130706433/',
	])('rejects private hostname %s', (url) => {
		expect(isAllowedExternalUrl(url)).toBe(false)
	})

	it('rejects empty and malformed input', () => {
		expect(isAllowedExternalUrl('')).toBe(false)
		expect(isAllowedExternalUrl('not a url')).toBe(false)
	})
})
