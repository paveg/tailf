import { describe, expect, it } from 'vitest'
import { decodeHtmlEntities, parseAtom, parseFeed, parseRss } from './rss'

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

describe('parseRss', () => {
	it('parses valid RSS 2.0 feed', () => {
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
			<rss version="2.0">
				<channel>
					<title>Test Blog</title>
					<link>https://example.com</link>
					<description>A test blog</description>
					<item>
						<title>First Post</title>
						<link>https://example.com/post1</link>
						<description>Post description</description>
						<pubDate>Mon, 01 Jan 2024 12:00:00 GMT</pubDate>
					</item>
				</channel>
			</rss>`

		const result = parseRss(xml)

		expect(result).not.toBeNull()
		expect(result?.title).toBe('Test Blog')
		expect(result?.link).toBe('https://example.com')
		expect(result?.description).toBe('A test blog')
		expect(result?.items).toHaveLength(1)
		expect(result?.items[0].title).toBe('First Post')
		expect(result?.items[0].link).toBe('https://example.com/post1')
	})

	it('parses RSS with CDATA sections', () => {
		const xml = `<?xml version="1.0"?>
			<rss version="2.0">
				<channel>
					<title><![CDATA[Blog with <special> chars]]></title>
					<link>https://example.com</link>
					<item>
						<title><![CDATA[Post with &amp; entity]]></title>
						<link>https://example.com/post</link>
					</item>
				</channel>
			</rss>`

		const result = parseRss(xml)

		expect(result).not.toBeNull()
		expect(result?.title).toBe('Blog with <special> chars')
		expect(result?.items[0].title).toBe('Post with & entity')
	})

	it('extracts thumbnail from enclosure', () => {
		const xml = `<?xml version="1.0"?>
			<rss version="2.0">
				<channel>
					<title>Blog</title>
					<link>https://example.com</link>
					<item>
						<title>Post with image</title>
						<link>https://example.com/post</link>
						<enclosure url="https://example.com/image.jpg" type="image/jpeg" />
					</item>
				</channel>
			</rss>`

		const result = parseRss(xml)

		expect(result?.items[0].thumbnail).toBe('https://example.com/image.jpg')
	})

	it('extracts thumbnail from media:thumbnail', () => {
		const xml = `<?xml version="1.0"?>
			<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">
				<channel>
					<title>Blog</title>
					<link>https://example.com</link>
					<item>
						<title>Post</title>
						<link>https://example.com/post</link>
						<media:thumbnail url="https://example.com/thumb.png" />
					</item>
				</channel>
			</rss>`

		const result = parseRss(xml)

		expect(result?.items[0].thumbnail).toBe('https://example.com/thumb.png')
	})

	it('uses guid as fallback for link', () => {
		const xml = `<?xml version="1.0"?>
			<rss version="2.0">
				<channel>
					<title>Blog</title>
					<link>https://example.com</link>
					<item>
						<title>Post</title>
						<guid>https://example.com/guid-link</guid>
					</item>
				</channel>
			</rss>`

		const result = parseRss(xml)

		expect(result?.items[0].link).toBe('https://example.com/guid-link')
	})

	it('parses multiple items', () => {
		const xml = `<?xml version="1.0"?>
			<rss version="2.0">
				<channel>
					<title>Blog</title>
					<link>https://example.com</link>
					<item><title>Post 1</title><link>https://example.com/1</link></item>
					<item><title>Post 2</title><link>https://example.com/2</link></item>
					<item><title>Post 3</title><link>https://example.com/3</link></item>
				</channel>
			</rss>`

		const result = parseRss(xml)

		expect(result?.items).toHaveLength(3)
		expect(result?.items[0].title).toBe('Post 1')
		expect(result?.items[1].title).toBe('Post 2')
		expect(result?.items[2].title).toBe('Post 3')
	})

	it('skips items without title or link', () => {
		const xml = `<?xml version="1.0"?>
			<rss version="2.0">
				<channel>
					<title>Blog</title>
					<link>https://example.com</link>
					<item><title>Valid Post</title><link>https://example.com/valid</link></item>
					<item><title>No Link</title></item>
					<item><link>https://example.com/no-title</link></item>
				</channel>
			</rss>`

		const result = parseRss(xml)

		expect(result?.items).toHaveLength(1)
		expect(result?.items[0].title).toBe('Valid Post')
	})

	it('returns null for invalid XML', () => {
		expect(parseRss('not xml')).toBeNull()
		expect(parseRss('<rss><item></item></rss>')).toBeNull() // no channel
	})

	it('decodes HTML entities in title and description', () => {
		const xml = `<?xml version="1.0"?>
			<rss version="2.0">
				<channel>
					<title>Blog</title>
					<link>https://example.com</link>
					<item>
						<title>React &amp; TypeScript入門</title>
						<link>https://example.com/post</link>
						<description>&lt;p&gt;Description&lt;/p&gt;</description>
					</item>
				</channel>
			</rss>`

		const result = parseRss(xml)

		expect(result?.items[0].title).toBe('React & TypeScript入門')
		// HTML entities are decoded, then tags are stripped
		expect(result?.items[0].description).toBe('Description')
	})

	it('strips XML tags from description', () => {
		const xml = `<?xml version="1.0"?>
			<rss version="2.0">
				<channel>
					<title>Blog</title>
					<link>https://example.com</link>
					<item>
						<title>Post</title>
						<link>https://example.com/post</link>
						<description><![CDATA[<link>https://example.com</link> <atom:link rel="self" /> Some text]]></description>
					</item>
				</channel>
			</rss>`

		const result = parseRss(xml)

		// XML tags should be stripped, leaving only text content
		expect(result?.items[0].description).toBe('https://example.com Some text')
	})

	it('handles description with mixed HTML and text', () => {
		const xml = `<?xml version="1.0"?>
			<rss version="2.0">
				<channel>
					<title>Blog</title>
					<link>https://example.com</link>
					<item>
						<title>Post</title>
						<link>https://example.com/post</link>
						<description><![CDATA[<p>First paragraph</p><p>Second paragraph</p>]]></description>
					</item>
				</channel>
			</rss>`

		const result = parseRss(xml)

		expect(result?.items[0].description).toBe('First paragraph Second paragraph')
	})
})

describe('parseAtom', () => {
	it('parses valid Atom feed', () => {
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
			<feed xmlns="http://www.w3.org/2005/Atom">
				<title>Test Blog</title>
				<subtitle>A test blog</subtitle>
				<link href="https://example.com" rel="alternate" />
				<entry>
					<title>First Post</title>
					<link href="https://example.com/post1" rel="alternate" />
					<summary>Post summary</summary>
					<published>2024-01-01T12:00:00Z</published>
				</entry>
			</feed>`

		const result = parseAtom(xml)

		expect(result).not.toBeNull()
		expect(result?.title).toBe('Test Blog')
		expect(result?.description).toBe('A test blog')
		expect(result?.link).toBe('https://example.com')
		expect(result?.items).toHaveLength(1)
		expect(result?.items[0].title).toBe('First Post')
		expect(result?.items[0].link).toBe('https://example.com/post1')
	})

	it('uses content as fallback for summary', () => {
		const xml = `<?xml version="1.0"?>
			<feed xmlns="http://www.w3.org/2005/Atom">
				<title>Blog</title>
				<link href="https://example.com" />
				<entry>
					<title>Post</title>
					<link href="https://example.com/post" />
					<content>Full content here</content>
				</entry>
			</feed>`

		const result = parseAtom(xml)

		expect(result?.items[0].description).toBe('Full content here')
	})

	it('uses updated as fallback for published', () => {
		const xml = `<?xml version="1.0"?>
			<feed xmlns="http://www.w3.org/2005/Atom">
				<title>Blog</title>
				<link href="https://example.com" />
				<entry>
					<title>Post</title>
					<link href="https://example.com/post" />
					<updated>2024-06-15T10:00:00Z</updated>
				</entry>
			</feed>`

		const result = parseAtom(xml)

		expect(result?.items[0].pubDate).toBe('2024-06-15T10:00:00Z')
	})

	it('parses multiple entries', () => {
		const xml = `<?xml version="1.0"?>
			<feed xmlns="http://www.w3.org/2005/Atom">
				<title>Blog</title>
				<link href="https://example.com" />
				<entry><title>Post 1</title><link href="https://example.com/1" /></entry>
				<entry><title>Post 2</title><link href="https://example.com/2" /></entry>
			</feed>`

		const result = parseAtom(xml)

		expect(result?.items).toHaveLength(2)
	})

	it('skips entries without title or link', () => {
		const xml = `<?xml version="1.0"?>
			<feed xmlns="http://www.w3.org/2005/Atom">
				<title>Blog</title>
				<link href="https://example.com" />
				<entry><title>Valid</title><link href="https://example.com/valid" /></entry>
				<entry><title>No Link</title></entry>
				<entry><link href="https://example.com/no-title" /></entry>
			</feed>`

		const result = parseAtom(xml)

		expect(result?.items).toHaveLength(1)
		expect(result?.items[0].title).toBe('Valid')
	})

	it('decodes HTML entities', () => {
		const xml = `<?xml version="1.0"?>
			<feed xmlns="http://www.w3.org/2005/Atom">
				<title>Blog</title>
				<link href="https://example.com" />
				<entry>
					<title>Go言語 &amp; Rust比較</title>
					<link href="https://example.com/post" />
					<summary>&quot;引用&quot;テスト</summary>
				</entry>
			</feed>`

		const result = parseAtom(xml)

		expect(result?.items[0].title).toBe('Go言語 & Rust比較')
		expect(result?.items[0].description).toBe('"引用"テスト')
	})
})

describe('RSS pubDate parsing', () => {
	it('parses RFC 2822 format with GMT', () => {
		const xml = `<?xml version="1.0"?>
			<rss version="2.0">
				<channel>
					<title>Blog</title>
					<link>https://example.com</link>
					<item>
						<title>Post</title>
						<link>https://example.com/post</link>
						<pubDate>Mon, 15 Jan 2024 12:00:00 GMT</pubDate>
					</item>
				</channel>
			</rss>`

		const result = parseRss(xml)
		expect(result?.items[0].pubDate).toBe('Mon, 15 Jan 2024 12:00:00 GMT')
	})

	it('parses RFC 2822 format with timezone offset', () => {
		const xml = `<?xml version="1.0"?>
			<rss version="2.0">
				<channel>
					<title>Blog</title>
					<link>https://example.com</link>
					<item>
						<title>Post</title>
						<link>https://example.com/post</link>
						<pubDate>Mon, 15 Jan 2024 21:00:00 +0900</pubDate>
					</item>
				</channel>
			</rss>`

		const result = parseRss(xml)
		expect(result?.items[0].pubDate).toBe('Mon, 15 Jan 2024 21:00:00 +0900')
	})

	it('parses ISO 8601 format (some feeds use this)', () => {
		const xml = `<?xml version="1.0"?>
			<rss version="2.0">
				<channel>
					<title>Blog</title>
					<link>https://example.com</link>
					<item>
						<title>Post</title>
						<link>https://example.com/post</link>
						<pubDate>2024-01-15T12:00:00Z</pubDate>
					</item>
				</channel>
			</rss>`

		const result = parseRss(xml)
		expect(result?.items[0].pubDate).toBe('2024-01-15T12:00:00Z')
	})

	it('handles missing pubDate', () => {
		const xml = `<?xml version="1.0"?>
			<rss version="2.0">
				<channel>
					<title>Blog</title>
					<link>https://example.com</link>
					<item>
						<title>Post</title>
						<link>https://example.com/post</link>
					</item>
				</channel>
			</rss>`

		const result = parseRss(xml)
		expect(result?.items[0].pubDate).toBeUndefined()
	})
})

describe('Atom date parsing', () => {
	it('parses ISO 8601 published date', () => {
		const xml = `<?xml version="1.0"?>
			<feed xmlns="http://www.w3.org/2005/Atom">
				<title>Blog</title>
				<link href="https://example.com" />
				<entry>
					<title>Post</title>
					<link href="https://example.com/post" />
					<published>2024-01-15T12:00:00Z</published>
				</entry>
			</feed>`

		const result = parseAtom(xml)
		expect(result?.items[0].pubDate).toBe('2024-01-15T12:00:00Z')
	})

	it('parses ISO 8601 with timezone offset', () => {
		const xml = `<?xml version="1.0"?>
			<feed xmlns="http://www.w3.org/2005/Atom">
				<title>Blog</title>
				<link href="https://example.com" />
				<entry>
					<title>Post</title>
					<link href="https://example.com/post" />
					<published>2024-01-15T21:00:00+09:00</published>
				</entry>
			</feed>`

		const result = parseAtom(xml)
		expect(result?.items[0].pubDate).toBe('2024-01-15T21:00:00+09:00')
	})

	it('uses updated as fallback when published is missing', () => {
		const xml = `<?xml version="1.0"?>
			<feed xmlns="http://www.w3.org/2005/Atom">
				<title>Blog</title>
				<link href="https://example.com" />
				<entry>
					<title>Post</title>
					<link href="https://example.com/post" />
					<updated>2024-01-15T12:00:00Z</updated>
				</entry>
			</feed>`

		const result = parseAtom(xml)
		expect(result?.items[0].pubDate).toBe('2024-01-15T12:00:00Z')
	})
})

describe('parseFeed', () => {
	it('detects and parses Atom feed', () => {
		const atomXml = `<?xml version="1.0"?>
			<feed xmlns="http://www.w3.org/2005/Atom">
				<title>Atom Blog</title>
				<link href="https://example.com" />
				<entry><title>Post</title><link href="https://example.com/post" /></entry>
			</feed>`

		const result = parseFeed(atomXml)

		expect(result).not.toBeNull()
		expect(result?.title).toBe('Atom Blog')
	})

	it('detects and parses Blogger-style Atom feed with single quotes', () => {
		// Blogger uses single quotes for xmlns declaration
		const bloggerAtomXml = `<?xml version='1.0' encoding='UTF-8'?>
			<feed xmlns='http://www.w3.org/2005/Atom'>
				<title type='text'>Google Developers Japan</title>
				<link rel='alternate' type='text/html' href='https://developers-jp.googleblog.com/'/>
				<entry>
					<title type='text'>テスト記事</title>
					<link rel='alternate' type='text/html' href='https://developers-jp.googleblog.com/2025/01/test.html'/>
				</entry>
			</feed>`

		const result = parseFeed(bloggerAtomXml)

		expect(result).not.toBeNull()
		expect(result?.title).toBe('Google Developers Japan')
		expect(result?.items).toHaveLength(1)
		expect(result?.items[0].title).toBe('テスト記事')
		expect(result?.items[0].link).toBe('https://developers-jp.googleblog.com/2025/01/test.html')
	})

	it('detects and parses RSS feed', () => {
		const rssXml = `<?xml version="1.0"?>
			<rss version="2.0">
				<channel>
					<title>RSS Blog</title>
					<link>https://example.com</link>
					<item><title>Post</title><link>https://example.com/post</link></item>
				</channel>
			</rss>`

		const result = parseFeed(rssXml)

		expect(result).not.toBeNull()
		expect(result?.title).toBe('RSS Blog')
	})

	it('falls back to RSS parser for unknown format', () => {
		// XML without Atom namespace - should try RSS parser
		const xml = `<?xml version="1.0"?>
			<rss version="2.0">
				<channel>
					<title>RSS without Atom namespace</title>
					<link>https://example.com</link>
					<item><title>Post</title><link>https://example.com/post</link></item>
				</channel>
			</rss>`

		const result = parseFeed(xml)
		// RSS parser should handle this
		expect(result).not.toBeNull()
		expect(result?.title).toBe('RSS without Atom namespace')
	})

	it('returns null for completely invalid XML', () => {
		expect(parseFeed('not valid xml at all')).toBeNull()
		expect(parseFeed('<html><body>Not a feed</body></html>')).toBeNull()
	})
})
