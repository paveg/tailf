import { describe, expect, it } from 'vitest'
import { cleanTextForScoring, decodeHtmlEntities } from './html'

describe('decodeHtmlEntities', () => {
	it('decodes named entities', () => {
		expect(decodeHtmlEntities('&amp;')).toBe('&')
		expect(decodeHtmlEntities('&lt;')).toBe('<')
		expect(decodeHtmlEntities('&gt;')).toBe('>')
		expect(decodeHtmlEntities('&quot;')).toBe('"')
		expect(decodeHtmlEntities('&apos;')).toBe("'")
	})

	it('decodes numeric entities', () => {
		expect(decodeHtmlEntities('&#39;')).toBe("'")
		expect(decodeHtmlEntities('&#60;')).toBe('<')
	})

	it('decodes hex entities', () => {
		expect(decodeHtmlEntities('&#x27;')).toBe("'")
		expect(decodeHtmlEntities('&#x3C;')).toBe('<')
	})

	it('handles text without entities', () => {
		expect(decodeHtmlEntities('Hello World')).toBe('Hello World')
		expect(decodeHtmlEntities('')).toBe('')
	})
})

describe('cleanTextForScoring', () => {
	it('decodes entities and strips HTML tags', () => {
		expect(cleanTextForScoring('<p>Hello &amp; World</p>')).toBe('Hello & World')
	})

	it('normalizes whitespace', () => {
		expect(cleanTextForScoring('  hello   world  ')).toBe('hello world')
	})

	it('handles &hellip; and &nbsp;', () => {
		expect(cleanTextForScoring('more&hellip;')).toBe('more...')
		expect(cleanTextForScoring('hello&nbsp;world')).toBe('hello world')
	})

	it('handles nested HTML with entities', () => {
		expect(cleanTextForScoring('<div><strong>React &amp; TypeScript</strong>入門</div>')).toBe(
			'React & TypeScript 入門',
		)
	})
})
