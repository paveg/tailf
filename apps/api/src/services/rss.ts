import { eq, gte } from 'drizzle-orm'
import type { Database } from '../db'
import { feeds, posts } from '../db/schema'
import { generateId } from '../utils/id'
import { getBookmarkCount } from './hatena'
import { calculateTechScore, calculateTechScoreWithEmbedding } from './tech-score'

interface RssItem {
	title: string
	link: string
	description?: string
	pubDate?: string
	thumbnail?: string
}

export interface RssFeed {
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

/**
 * Calculate tech score with AI embedding if available, fallback to keyword-based
 */
async function getTechScore(ai: Ai | undefined, title: string, summary?: string): Promise<number> {
	if (ai) {
		try {
			return await calculateTechScoreWithEmbedding(ai, title, summary)
		} catch (error) {
			console.warn('[TechScore] Embedding failed, using keyword fallback:', error)
		}
	}
	return calculateTechScore(title, summary)
}

export async function fetchRssFeeds(db: Database, ai?: Ai): Promise<void> {
	console.log('Starting RSS feed fetch...')
	console.log(`[TechScore] Using ${ai ? 'embedding-based' : 'keyword-based'} scoring`)

	const allFeeds = await db.query.feeds.findMany()

	for (const feed of allFeeds) {
		try {
			console.log(`Fetching: ${feed.feedUrl}`)

			const response = await fetch(feed.feedUrl, {
				headers: {
					'User-Agent': 'tailf RSS Aggregator',
				},
			})

			if (!response.ok) {
				console.error(`Failed to fetch ${feed.feedUrl}: ${response.status}`)
				continue
			}

			const xml = await response.text()
			const parsedFeed = parseFeed(xml)

			if (!parsedFeed) {
				console.error(`Failed to parse feed: ${feed.feedUrl}`)
				continue
			}

			// Update feed metadata if description is missing
			if (!feed.description && parsedFeed.description) {
				await db
					.update(feeds)
					.set({ description: parsedFeed.description.slice(0, 500) })
					.where(eq(feeds.id, feed.id))
				console.log(`Updated description for: ${feed.title}`)
			}

			// Insert new posts
			for (const item of parsedFeed.items) {
				const publishedAt = item.pubDate ? new Date(item.pubDate) : new Date()

				// Check if post already exists
				const existing = await db.query.posts.findFirst({
					where: eq(posts.url, item.link),
				})

				if (!existing) {
					const summary = item.description?.slice(0, 500)
					const techScore = await getTechScore(ai, item.title, summary)
					await db.insert(posts).values({
						id: generateId(),
						title: item.title,
						summary,
						url: item.link,
						thumbnailUrl: item.thumbnail,
						publishedAt,
						feedId: feed.id,
						techScore,
					})
					console.log(`Added: ${item.title} (techScore: ${techScore.toFixed(2)})`)
				}
			}
		} catch (error) {
			console.error(`Error processing ${feed.feedUrl}:`, error)
		}
	}

	console.log('RSS feed fetch complete.')

	// Update Hatena bookmark counts for recent posts
	await updateHatenaBookmarkCounts(db)
}

/**
 * Update Hatena bookmark counts for recent posts (past 7 days)
 * Called after RSS feed fetch to update bookmark counts
 */
async function updateHatenaBookmarkCounts(db: Database): Promise<void> {
	console.log('[Hatena] Starting bookmark count update...')

	const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

	const recentPosts = await db.query.posts.findMany({
		where: gte(posts.publishedAt, oneWeekAgo),
		columns: { id: true, url: true, hatenaBookmarkCount: true },
	})

	console.log(`[Hatena] Updating ${recentPosts.length} recent posts`)

	let updated = 0
	for (const post of recentPosts) {
		try {
			const count = await getBookmarkCount(post.url)

			// Only update if count changed
			if (count !== post.hatenaBookmarkCount) {
				await db.update(posts).set({ hatenaBookmarkCount: count }).where(eq(posts.id, post.id))
				updated++
			}

			// Rate limiting: 100ms delay between requests
			await new Promise((resolve) => setTimeout(resolve, 100))
		} catch (error) {
			console.warn(`[Hatena] Failed to update bookmark count for ${post.url}:`, error)
		}
	}

	console.log(`[Hatena] Updated ${updated} posts with new bookmark counts`)
}

// Fetch single feed and return parsed result (for blog registration)
export async function fetchAndParseFeed(feedUrl: string): Promise<RssFeed | null> {
	try {
		const response = await fetch(feedUrl, {
			headers: {
				'User-Agent': 'tailf RSS Aggregator',
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
