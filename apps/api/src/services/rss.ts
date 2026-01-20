import { eq } from 'drizzle-orm'
import type { Database } from '../db'
import { posts } from '../db/schema'
import { generateId } from '../utils/id'

interface RssItem {
	title: string
	link: string
	description?: string
	pubDate?: string
	thumbnail?: string
}

interface RssFeed {
	title: string
	description?: string
	link: string
	items: RssItem[]
}

// Simple XML parser for RSS feeds (Cloudflare Workers compatible)
function parseRss(xml: string): RssFeed | null {
	try {
		// Extract channel info
		const channelMatch = xml.match(/<channel>([\s\S]*?)<\/channel>/i)
		if (!channelMatch) return null

		const channel = channelMatch[1]

		const getTagContent = (tag: string, content: string): string | undefined => {
			const match = content.match(
				new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i'),
			)
			if (match) return match[1].trim()

			const simpleMatch = content.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'))
			return simpleMatch ? simpleMatch[1].trim() : undefined
		}

		// Parse items
		const items: RssItem[] = []
		const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)

		for (const match of itemMatches) {
			const itemContent = match[1]
			const title = getTagContent('title', itemContent)
			const link = getTagContent('link', itemContent) || getTagContent('guid', itemContent)

			if (title && link) {
				// Try to get thumbnail from various sources
				let thumbnail: string | undefined
				const enclosureMatch = itemContent.match(/<enclosure[^>]+url="([^"]+)"[^>]*type="image/i)
				if (enclosureMatch) {
					thumbnail = enclosureMatch[1]
				}
				const mediaMatch = itemContent.match(/<media:thumbnail[^>]+url="([^"]+)"/i)
				if (!thumbnail && mediaMatch) {
					thumbnail = mediaMatch[1]
				}

				items.push({
					title,
					link,
					description: getTagContent('description', itemContent),
					pubDate: getTagContent('pubDate', itemContent),
					thumbnail,
				})
			}
		}

		return {
			title: getTagContent('title', channel) || 'Unknown',
			description: getTagContent('description', channel),
			link: getTagContent('link', channel) || '',
			items,
		}
	} catch (error) {
		console.error('Failed to parse RSS:', error)
		return null
	}
}

// Also support Atom feeds
function parseAtom(xml: string): RssFeed | null {
	try {
		const getTagContent = (tag: string, content: string): string | undefined => {
			const match = content.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'))
			return match ? match[1].trim() : undefined
		}

		const getLinkHref = (content: string): string | undefined => {
			const match = content.match(/<link[^>]+href="([^"]+)"[^>]*rel="alternate"/i)
			if (match) return match[1]
			const simpleMatch = content.match(/<link[^>]+href="([^"]+)"/i)
			return simpleMatch ? simpleMatch[1] : undefined
		}

		const title = getTagContent('title', xml) || 'Unknown'
		const description = getTagContent('subtitle', xml)
		const link = getLinkHref(xml) || ''

		const items: RssItem[] = []
		const entryMatches = xml.matchAll(/<entry>([\s\S]*?)<\/entry>/gi)

		for (const match of entryMatches) {
			const entryContent = match[1]
			const itemTitle = getTagContent('title', entryContent)
			const itemLink = getLinkHref(entryContent)

			if (itemTitle && itemLink) {
				items.push({
					title: itemTitle,
					link: itemLink,
					description:
						getTagContent('summary', entryContent) || getTagContent('content', entryContent),
					pubDate:
						getTagContent('published', entryContent) || getTagContent('updated', entryContent),
				})
			}
		}

		return { title, description, link, items }
	} catch (error) {
		console.error('Failed to parse Atom:', error)
		return null
	}
}

function parseFeed(xml: string): RssFeed | null {
	if (xml.includes('<feed') && xml.includes('xmlns="http://www.w3.org/2005/Atom"')) {
		return parseAtom(xml)
	}
	return parseRss(xml)
}

export async function fetchRssFeeds(db: Database): Promise<void> {
	console.log('Starting RSS feed fetch...')

	const allBlogs = await db.query.blogs.findMany()

	for (const blog of allBlogs) {
		try {
			console.log(`Fetching: ${blog.feedUrl}`)

			const response = await fetch(blog.feedUrl, {
				headers: {
					'User-Agent': 'tailf.dev RSS Aggregator',
				},
			})

			if (!response.ok) {
				console.error(`Failed to fetch ${blog.feedUrl}: ${response.status}`)
				continue
			}

			const xml = await response.text()
			const feed = parseFeed(xml)

			if (!feed) {
				console.error(`Failed to parse feed: ${blog.feedUrl}`)
				continue
			}

			// Insert new posts
			for (const item of feed.items) {
				const publishedAt = item.pubDate ? new Date(item.pubDate) : new Date()

				// Check if post already exists
				const existing = await db.query.posts.findFirst({
					where: eq(posts.url, item.link),
				})

				if (!existing) {
					await db.insert(posts).values({
						id: generateId(),
						title: item.title,
						summary: item.description?.slice(0, 500),
						url: item.link,
						thumbnailUrl: item.thumbnail,
						publishedAt,
						blogId: blog.id,
					})
					console.log(`Added: ${item.title}`)
				}
			}
		} catch (error) {
			console.error(`Error processing ${blog.feedUrl}:`, error)
		}
	}

	console.log('RSS feed fetch complete.')
}

// Fetch single feed and return parsed result (for blog registration)
export async function fetchAndParseFeed(feedUrl: string): Promise<RssFeed | null> {
	try {
		const response = await fetch(feedUrl, {
			headers: {
				'User-Agent': 'tailf.dev RSS Aggregator',
			},
		})

		if (!response.ok) {
			return null
		}

		const xml = await response.text()
		return parseFeed(xml)
	} catch {
		return null
	}
}
