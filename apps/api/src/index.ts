import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { createDb } from './db'
import { adminRoute } from './routes/admin'
import { authRoute } from './routes/auth'
import { userFeedRoute } from './routes/feed'
import { feedsRoute } from './routes/feeds'
import { postsRoute } from './routes/posts'
import { reconcileBookmarkCounts } from './services/feed-sync'
import { updateRecentBookmarkCounts } from './services/hatena'
import { fetchRssFeeds } from './services/rss'

export type Env = {
	DB: D1Database
	AI: Ai
	GITHUB_CLIENT_ID: string
	GITHUB_CLIENT_SECRET: string
	SESSION_SECRET: string
	ENVIRONMENT: string
	API_URL?: string
	APP_URL?: string
	ADMIN_SECRET?: string
}

type Variables = {
	db: ReturnType<typeof createDb>
}

const app = new Hono<{ Bindings: Env; Variables: Variables }>()

// Middleware
app.use('*', logger())
app.use(
	'*',
	cors({
		origin: (origin) => {
			// Allow localhost and tailf
			if (origin.includes('localhost') || origin.includes('tailf')) {
				return origin
			}
			return null
		},
		credentials: true,
	}),
)

// DB middleware
app.use('*', async (c, next) => {
	c.set('db', createDb(c.env.DB))
	await next()
})

// Health check
app.get('/health', (c) => c.json({ status: 'ok' }))

// Routes
app.route('/api/auth', authRoute)
app.route('/api/feeds', feedsRoute)
app.route('/api/posts', postsRoute)
app.route('/api/feed', userFeedRoute)
app.route('/api/admin', adminRoute)

// Cron handler for RSS fetching and bookmark updates
export default {
	fetch: app.fetch,
	async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
		const db = createDb(env.DB)
		ctx.waitUntil(
			(async () => {
				// Phase 1: RSS fetch + reconcile in parallel
				// (reconcile is DB-only, no external API calls)
				await Promise.all([fetchRssFeeds(db, env.AI), reconcileBookmarkCounts(db)])

				// Phase 2: Hatena bookmark update (sequential to avoid subrequest limit)
				// This runs after RSS fetch completes, spreading out external API calls
				await updateRecentBookmarkCounts(db)
			})(),
		)
	},
}
