import { relations } from 'drizzle-orm'
import { index, integer, primaryKey, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'

// Users table
export const users = sqliteTable('users', {
	id: text('id').primaryKey(),
	githubId: text('github_id').notNull().unique(),
	name: text('name').notNull(),
	avatarUrl: text('avatar_url'),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date()),
})

// Feed types
export const FEED_TYPES = ['blog', 'slide'] as const
export type FeedType = (typeof FEED_TYPES)[number]

// Feeds table (RSS/Atom feed sources: blogs, slides, etc.)
// TODO: 将来的に公式フィード申請フローを実装する場合:
// - feed_requests テーブルを追加（status: pending/approved/rejected）
// - 管理画面で承認/却下
// - 承認時に isOfficial: 1 で feeds に登録
export const feeds = sqliteTable(
	'feeds',
	{
		id: text('id').primaryKey(),
		title: text('title').notNull(),
		description: text('description'),
		feedUrl: text('feed_url').notNull().unique(),
		siteUrl: text('site_url').notNull(),
		type: text('type').$type<FeedType>().notNull().default('blog'),
		// 公式フィードフラグ（会社・組織の公式テックブログ等）
		// 現在は GitHub Issue 経由で手動管理、将来的に申請フロー実装予定
		isOfficial: integer('is_official', { mode: 'boolean' }).notNull().default(false),
		// ブックマーク数（ブックマーク追加/削除時に更新）
		bookmarkCount: integer('bookmark_count').notNull().default(0),
		authorId: text('author_id').references(() => users.id),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date()),
		updatedAt: integer('updated_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date()),
	},
	(table) => [
		index('feeds_author_id_idx').on(table.authorId),
		index('feeds_type_idx').on(table.type),
	],
)

// Posts table
export const posts = sqliteTable(
	'posts',
	{
		id: text('id').primaryKey(),
		title: text('title').notNull(),
		summary: text('summary'),
		url: text('url').notNull().unique(),
		thumbnailUrl: text('thumbnail_url'),
		publishedAt: integer('published_at', { mode: 'timestamp' }).notNull(),
		feedId: text('feed_id')
			.notNull()
			.references(() => feeds.id, { onDelete: 'cascade' }),
		techScore: real('tech_score'), // 0.0〜1.0、技術記事度スコア（nullは未計算）
		hatenaBookmarkCount: integer('hatena_bookmark_count'), // はてなブックマーク数（nullは未取得）
		// Topic assignment (auto-assigned via keyword matching)
		mainTopic: text('main_topic'), // Primary topic (highest keyword score)
		subTopic: text('sub_topic'), // Secondary topic (second highest score, optional)
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date()),
	},
	(table) => [
		index('posts_feed_id_idx').on(table.feedId),
		index('posts_published_at_idx').on(table.publishedAt),
		index('posts_tech_score_idx').on(table.techScore),
		index('posts_hatena_bookmark_count_idx').on(table.hatenaBookmarkCount),
		index('posts_main_topic_idx').on(table.mainTopic),
		index('posts_sub_topic_idx').on(table.subTopic),
	],
)

// Feed bookmarks table (many-to-many: users <-> feeds)
export const feedBookmarks = sqliteTable(
	'feed_bookmarks',
	{
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		feedId: text('feed_id')
			.notNull()
			.references(() => feeds.id, { onDelete: 'cascade' }),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date()),
	},
	(table) => [primaryKey({ columns: [table.userId, table.feedId] })],
)

// Sessions table (for authentication)
export const sessions = sqliteTable('sessions', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
})

// Relations
export const usersRelations = relations(users, ({ many }) => ({
	feeds: many(feeds),
	bookmarks: many(feedBookmarks),
	sessions: many(sessions),
}))

export const feedsRelations = relations(feeds, ({ one, many }) => ({
	author: one(users, {
		fields: [feeds.authorId],
		references: [users.id],
	}),
	posts: many(posts),
	bookmarkedBy: many(feedBookmarks),
}))

export const postsRelations = relations(posts, ({ one }) => ({
	feed: one(feeds, {
		fields: [posts.feedId],
		references: [feeds.id],
	}),
}))

export const feedBookmarksRelations = relations(feedBookmarks, ({ one }) => ({
	user: one(users, {
		fields: [feedBookmarks.userId],
		references: [users.id],
	}),
	feed: one(feeds, {
		fields: [feedBookmarks.feedId],
		references: [feeds.id],
	}),
}))

export const sessionsRelations = relations(sessions, ({ one }) => ({
	user: one(users, {
		fields: [sessions.userId],
		references: [users.id],
	}),
}))
