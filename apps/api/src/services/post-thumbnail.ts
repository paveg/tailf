import { and, eq, inArray } from 'drizzle-orm'
import type { Database } from '../db'
import { feeds, posts } from '../db/schema'

export function feedIdsUsingImages(db: Database) {
	return db.select({ id: feeds.id }).from(feeds).where(eq(feeds.useImages, true))
}

// The flag is checked in the UPDATE itself so a feed that opted out after the caller read it stays image-free.
export async function setPostThumbnail(db: Database, postId: string, thumbnailUrl: string) {
	await db
		.update(posts)
		.set({ thumbnailUrl })
		.where(and(eq(posts.id, postId), inArray(posts.feedId, feedIdsUsingImages(db))))
}
