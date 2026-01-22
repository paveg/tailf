import { eq, gte } from 'drizzle-orm'
import type { Database } from '../db'
import { feeds, posts } from '../db/schema'
import { DURATIONS } from '../utils/date'
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

/**
 * Extract tag content from XML, handling CDATA sections
 * Tries CDATA first, falls back to simple tag content
 */
function getTagContent(tag: string, content: string): string | undefined {
	const cdataMatch = content.match(
		new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i'),
	)
	if (cdataMatch) return cdataMatch[1].trim()

	const simpleMatch = content.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'))
	return simpleMatch?.[1].trim()
}

/**
 * Extract href from link tag (for Atom feeds)
 * Prefers rel="alternate" links, falls back to any link with href
 */
function getLinkHref(content: string): string | undefined {
	const altMatch = content.match(/<link[^>]+href="([^"]+)"[^>]*rel="alternate"/i)
	if (altMatch) return altMatch[1]

	const simpleMatch = content.match(/<link[^>]+href="([^"]+)"/i)
	return simpleMatch?.[1]
}

/**
 * Decode HTML entities in a string
 * Handles common entities: &amp; &lt; &gt; &quot; &apos; and numeric entities
 */
export function decodeHtmlEntities(text: string): string {
	return text
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&#39;/g, "'")
		.replace(/&#x27;/g, "'")
		.replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
		.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
}

/**
 * Strip XML/HTML tags from text and clean up whitespace
 */
function stripTags(text: string): string {
	return text
		.replace(/<[^>]+>/g, ' ') // Replace tags with space to preserve word boundaries
		.replace(/\s+/g, ' ') // Normalize whitespace
		.trim()
}

/**
 * Clean description text: decode entities and strip any remaining tags
 */
function cleanDescription(text: string | undefined): string | undefined {
	if (!text) return undefined
	const cleaned = stripTags(decodeHtmlEntities(text))
	return cleaned || undefined // Return undefined if empty after cleaning
}

export interface RssFeed {
	title: string
	description?: string
	link: string
	items: RssItem[]
}

// Simple XML parser for RSS feeds (Cloudflare Workers compatible)
export function parseRss(xml: string): RssFeed | null {
	try {
		// Extract channel info
		const channelMatch = xml.match(/<channel>([\s\S]*?)<\/channel>/i)
		if (!channelMatch) return null

		const channel = channelMatch[1]

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
				// Fallback: extract first img from content:encoded or description
				if (!thumbnail) {
					const contentEncoded = getTagContent('content:encoded', itemContent)
					const imgMatch = (contentEncoded || itemContent).match(/<img[^>]+src="([^"]+)"/i)
					if (imgMatch) {
						thumbnail = imgMatch[1]
					}
				}

				const description = getTagContent('description', itemContent)
				items.push({
					title: decodeHtmlEntities(title),
					link,
					description: cleanDescription(description),
					pubDate: getTagContent('pubDate', itemContent),
					thumbnail,
				})
			}
		}

		return {
			title: decodeHtmlEntities(getTagContent('title', channel) || 'Unknown'),
			description: cleanDescription(getTagContent('description', channel)),
			link: getTagContent('link', channel) || '',
			items,
		}
	} catch (error) {
		console.error('Failed to parse RSS:', error)
		return null
	}
}

// Also support Atom feeds
export function parseAtom(xml: string): RssFeed | null {
	try {
		const title = decodeHtmlEntities(getTagContent('title', xml) || 'Unknown')
		const description = cleanDescription(getTagContent('subtitle', xml))
		const link = getLinkHref(xml) || ''

		const items: RssItem[] = []
		const entryMatches = xml.matchAll(/<entry>([\s\S]*?)<\/entry>/gi)

		for (const match of entryMatches) {
			const entryContent = match[1]
			const itemTitle = getTagContent('title', entryContent)
			const itemLink = getLinkHref(entryContent)

			if (itemTitle && itemLink) {
				// Try to get thumbnail from enclosure link (common in Hatena Blog)
				let thumbnail: string | undefined
				const enclosureMatch = entryContent.match(
					/<link[^>]+rel="enclosure"[^>]+href="([^"]+)"[^>]+type="image/i,
				)
				if (enclosureMatch) {
					thumbnail = enclosureMatch[1]
				}
				// Also try media:thumbnail (some Atom feeds use this)
				if (!thumbnail) {
					const mediaMatch = entryContent.match(/<media:thumbnail[^>]+url="([^"]+)"/i)
					if (mediaMatch) {
						thumbnail = mediaMatch[1]
					}
				}
				// Fallback: extract first img from content or summary
				if (!thumbnail) {
					const content = getTagContent('content', entryContent)
					const imgMatch = (content || entryContent).match(/<img[^>]+src="([^"]+)"/i)
					if (imgMatch) {
						thumbnail = imgMatch[1]
					}
				}

				const itemDescription =
					getTagContent('summary', entryContent) || getTagContent('content', entryContent)
				items.push({
					title: decodeHtmlEntities(itemTitle),
					link: itemLink,
					description: cleanDescription(itemDescription),
					pubDate:
						getTagContent('published', entryContent) || getTagContent('updated', entryContent),
					thumbnail,
				})
			}
		}

		return { title, description, link, items }
	} catch (error) {
		console.error('Failed to parse Atom:', error)
		return null
	}
}

export function parseFeed(xml: string): RssFeed | null {
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

	const oneWeekAgo = new Date(Date.now() - DURATIONS.WEEK_MS)

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
