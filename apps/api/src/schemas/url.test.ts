import { isSafeUrl } from '@tailf/shared'
import { describe, expect, it } from 'vitest'

/**
 * Tests for the shared isSafeUrl helper that gates RSS-derived URLs
 * before they are rendered in <a href> attributes on the frontend.
 * Only http: and https: are considered safe; everything else (notably
 * javascript: and data:) must be rejected to prevent stored XSS.
 */

describe('isSafeUrl', () => {
	it('returns true for plain https URLs', () => {
		expect(isSafeUrl('https://example.com/post/1')).toBe(true)
	})

	it('returns true for http URLs', () => {
		expect(isSafeUrl('http://example.com/feed.xml')).toBe(true)
	})

	it('returns true for https URLs with query and fragment', () => {
		expect(isSafeUrl('https://example.com/post?id=42#top')).toBe(true)
	})

	it('rejects javascript: scheme (lowercase)', () => {
		expect(isSafeUrl('javascript:alert(1)')).toBe(false)
	})

	it('rejects javascript: scheme (uppercase)', () => {
		expect(isSafeUrl('JAVASCRIPT:alert(1)')).toBe(false)
	})

	it('rejects javascript: scheme with mixed case', () => {
		expect(isSafeUrl('JaVaScRiPt:alert(1)')).toBe(false)
	})

	it('rejects javascript: scheme with leading whitespace', () => {
		expect(isSafeUrl('   javascript:alert(1)')).toBe(false)
	})

	it('rejects javascript: scheme with leading control chars', () => {
		// Browsers strip various Unicode whitespace before scheme parsing,
		// so attackers may pad payloads with \t, \n, \r.
		expect(isSafeUrl('\t\n javascript:alert(1)')).toBe(false)
	})

	it('rejects data: URLs', () => {
		expect(isSafeUrl('data:text/html,<script>alert(1)</script>')).toBe(false)
	})

	it('rejects file: URLs', () => {
		expect(isSafeUrl('file:///etc/passwd')).toBe(false)
	})

	it('rejects ftp: URLs', () => {
		expect(isSafeUrl('ftp://example.com/file')).toBe(false)
	})

	it('rejects mailto: URLs', () => {
		expect(isSafeUrl('mailto:victim@example.com')).toBe(false)
	})

	it('rejects gopher: URLs', () => {
		expect(isSafeUrl('gopher://example.com/')).toBe(false)
	})

	it('rejects empty string', () => {
		expect(isSafeUrl('')).toBe(false)
	})

	it('rejects malformed URL', () => {
		expect(isSafeUrl('not a url')).toBe(false)
	})

	it('rejects protocol-relative URL', () => {
		// //evil.com would inherit the page's scheme; we require explicit http(s).
		expect(isSafeUrl('//evil.com/path')).toBe(false)
	})

	it('rejects relative path without scheme', () => {
		expect(isSafeUrl('/foo/bar')).toBe(false)
	})

	it('rejects string that looks like a scheme but lacks colon', () => {
		expect(isSafeUrl('javascriptnotreally')).toBe(false)
	})
})
