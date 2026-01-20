import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { createDb } from './db'
import { authRoute } from './routes/auth'
import { userFeedRoute } from './routes/feed'
import { feedsRoute } from './routes/feeds'
import { postsRoute } from './routes/posts'
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
			// Allow localhost and tailf.dev
			if (origin.includes('localhost') || origin.includes('tailf.dev')) {
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

// Cron handler for RSS fetching
export default {
	fetch: app.fetch,
	async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
		// Pass AI binding for embedding-based tech score calculation
		ctx.waitUntil(fetchRssFeeds(createDb(env.DB), env.AI))
	},
}
