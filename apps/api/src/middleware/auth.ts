import { eq } from 'drizzle-orm'
import type { Context, Next } from 'hono'
import { deleteCookie, getCookie } from 'hono/cookie'
import type { Database } from '../db'
import { sessions } from '../db/schema'

type AuthEnv = {
	Variables: {
		db: Database
		userId: string
	}
}

/**
 * Middleware to require authenticated session.
 * Sets userId in context variables on success.
 */
export async function requireAuth(c: Context<AuthEnv>, next: Next) {
	const sessionId = getCookie(c, 'session')
	if (!sessionId) {
		return c.json({ error: 'Unauthorized' }, 401)
	}

	const db = c.get('db')
	const session = await db.query.sessions.findFirst({
		where: eq(sessions.id, sessionId),
	})

	if (!session || session.expiresAt < new Date()) {
		deleteCookie(c, 'session')
		return c.json({ error: 'Session expired' }, 401)
	}

	c.set('userId', session.userId)
	await next()
}
