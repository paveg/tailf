import { relations } from 'drizzle-orm'
import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'

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

// Blogs table
export const blogs = sqliteTable(
	'blogs',
	{
		id: text('id').primaryKey(),
		title: text('title').notNull(),
		description: text('description'),
		feedUrl: text('feed_url').notNull().unique(),
		siteUrl: text('site_url').notNull(),
		authorId: text('author_id').references(() => users.id),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date()),
		updatedAt: integer('updated_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date()),
	},
	(table) => [index('blogs_author_id_idx').on(table.authorId)],
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
		blogId: text('blog_id')
			.notNull()
			.references(() => blogs.id, { onDelete: 'cascade' }),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date()),
	},
	(table) => [
		index('posts_blog_id_idx').on(table.blogId),
		index('posts_published_at_idx').on(table.publishedAt),
	],
)

// Follows table (many-to-many: users <-> blogs)
export const follows = sqliteTable(
	'follows',
	{
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		blogId: text('blog_id')
			.notNull()
			.references(() => blogs.id, { onDelete: 'cascade' }),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date()),
	},
	(table) => [primaryKey({ columns: [table.userId, table.blogId] })],
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
	blogs: many(blogs),
	follows: many(follows),
	sessions: many(sessions),
}))

export const blogsRelations = relations(blogs, ({ one, many }) => ({
	author: one(users, {
		fields: [blogs.authorId],
		references: [users.id],
	}),
	posts: many(posts),
	followers: many(follows),
}))

export const postsRelations = relations(posts, ({ one }) => ({
	blog: one(blogs, {
		fields: [posts.blogId],
		references: [blogs.id],
	}),
}))

export const followsRelations = relations(follows, ({ one }) => ({
	user: one(users, {
		fields: [follows.userId],
		references: [users.id],
	}),
	blog: one(blogs, {
		fields: [follows.blogId],
		references: [blogs.id],
	}),
}))

export const sessionsRelations = relations(sessions, ({ one }) => ({
	user: one(users, {
		fields: [sessions.userId],
		references: [users.id],
	}),
}))
