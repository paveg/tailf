import { describe, expect, it } from 'vitest'
import { decodeHtmlEntities } from './rss'

describe('decodeHtmlEntities', () => {
	it('decodes basic HTML entities', () => {
		expect(decodeHtmlEntities('&amp;')).toBe('&')
		expect(decodeHtmlEntities('&lt;')).toBe('<')
		expect(decodeHtmlEntities('&gt;')).toBe('>')
		expect(decodeHtmlEntities('&quot;')).toBe('"')
		expect(decodeHtmlEntities('&apos;')).toBe("'")
	})

	it('decodes numeric character references (decimal)', () => {
		expect(decodeHtmlEntities('&#39;')).toBe("'")
		expect(decodeHtmlEntities('&#60;')).toBe('<')
		expect(decodeHtmlEntities('&#62;')).toBe('>')
		expect(decodeHtmlEntities('&#34;')).toBe('"')
		expect(decodeHtmlEntities('&#38;')).toBe('&')
	})

	it('decodes numeric character references (hexadecimal)', () => {
		expect(decodeHtmlEntities('&#x27;')).toBe("'")
		expect(decodeHtmlEntities('&#x3C;')).toBe('<')
		expect(decodeHtmlEntities('&#x3E;')).toBe('>')
		expect(decodeHtmlEntities('&#x22;')).toBe('"')
		expect(decodeHtmlEntities('&#x26;')).toBe('&')
	})

	it('handles mixed entities in text', () => {
		expect(decodeHtmlEntities('Hello &amp; World')).toBe('Hello & World')
		expect(decodeHtmlEntities('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;')).toBe(
			'<script>alert("xss")</script>',
		)
		expect(decodeHtmlEntities('It&apos;s a &quot;test&quot;')).toBe('It\'s a "test"')
	})

	it('handles Japanese text with entities', () => {
		expect(decodeHtmlEntities('React &amp; TypeScript入門')).toBe('React & TypeScript入門')
		expect(decodeHtmlEntities('「&lt;html&gt;」タグ')).toBe('「<html>」タグ')
	})

	it('handles multiple occurrences of same entity', () => {
		expect(decodeHtmlEntities('A &amp; B &amp; C')).toBe('A & B & C')
		expect(decodeHtmlEntities('&lt;&lt;&lt;')).toBe('<<<')
	})

	it('preserves text without entities', () => {
		expect(decodeHtmlEntities('Hello World')).toBe('Hello World')
		expect(decodeHtmlEntities('日本語テキスト')).toBe('日本語テキスト')
		expect(decodeHtmlEntities('')).toBe('')
	})

	it('handles real-world RSS title examples', () => {
		// Actual examples from RSS feeds that might have double-encoded entities
		expect(decodeHtmlEntities('Go言語 &amp; Rust比較')).toBe('Go言語 & Rust比較')
		expect(decodeHtmlEntities('Next.js 15の&quot;use cache&quot;を解説')).toBe(
			'Next.js 15の"use cache"を解説',
		)
	})

	it('handles edge cases', () => {
		// Incomplete entities should remain unchanged (not matched)
		expect(decodeHtmlEntities('&unknown;')).toBe('&unknown;')
		// Already decoded text
		expect(decodeHtmlEntities('Hello & World')).toBe('Hello & World')
	})
})
