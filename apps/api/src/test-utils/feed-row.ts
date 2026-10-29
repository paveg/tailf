import { getTableColumns } from 'drizzle-orm'
import { feeds } from '../db/schema'

type FeedRowValues = Record<keyof typeof feeds.$inferSelect, unknown>

const defaults: FeedRowValues = {
	id: 'f1',
	title: 'Feed',
	description: null,
	feedUrl: 'https://ex.com/feed',
	siteUrl: 'https://ex.com',
	type: 'blog',
	isOfficial: 0,
	useImages: 1,
	bookmarkCount: 0,
	lastFetchedAt: null,
	authorId: null,
	createdAt: 0,
	updatedAt: 0,
}

export function feedRow(overrides: Partial<FeedRowValues> = {}): unknown[] {
	const values = { ...defaults, ...overrides }
	return Object.keys(getTableColumns(feeds)).map((key) => values[key as keyof FeedRowValues])
}
