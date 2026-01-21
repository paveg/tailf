import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import type { Env } from '..'
import type { Database } from '../db'
import { sessions, users } from '../db/schema'
import { DURATIONS, isSessionExpired } from '../utils/date'
import { generateId } from '../utils/id'

type Variables = {
	db: Database
}

export const authRoute = new Hono<{ Bindings: Env; Variables: Variables }>()

// GitHub OAuth login - redirect to GitHub
authRoute.get('/github', (c) => {
	const clientId = c.env.GITHUB_CLIENT_ID
	const apiUrl = c.env.API_URL || new URL(c.req.url).origin
	const redirectUri = `${apiUrl}/api/auth/github/callback`

	const params = new URLSearchParams({
		client_id: clientId,
		redirect_uri: redirectUri,
		scope: 'read:user',
	})

	return c.redirect(`https://github.com/login/oauth/authorize?${params}`)
})

// GitHub OAuth callback
authRoute.get('/github/callback', async (c) => {
	const code = c.req.query('code')
	if (!code) {
		return c.json({ error: 'No code provided' }, 400)
	}

	const db = c.get('db')

	// Exchange code for access token
	const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Accept: 'application/json',
		},
		body: JSON.stringify({
			client_id: c.env.GITHUB_CLIENT_ID,
			client_secret: c.env.GITHUB_CLIENT_SECRET,
			code,
		}),
	})

	const tokenData = (await tokenResponse.json()) as { access_token?: string; error?: string }
	if (!tokenData.access_token) {
		return c.json({ error: 'Failed to get access token' }, 400)
	}

	// Get user info from GitHub
	const userResponse = await fetch('https://api.github.com/user', {
		headers: {
			Authorization: `Bearer ${tokenData.access_token}`,
			'User-Agent': 'tailf',
		},
	})

	const githubUser = (await userResponse.json()) as {
		id: number
		login: string
		avatar_url: string
	}

	// Find or create user
	let user = await db.query.users.findFirst({
		where: eq(users.githubId, String(githubUser.id)),
	})

	if (!user) {
		const userId = generateId()
		await db.insert(users).values({
			id: userId,
			githubId: String(githubUser.id),
			name: githubUser.login,
			avatarUrl: githubUser.avatar_url,
		})
		user = await db.query.users.findFirst({
			where: eq(users.id, userId),
		})
	}

	if (!user) {
		return c.json({ error: 'Failed to create user' }, 500)
	}

	// Create session
	const sessionId = generateId()
	const expiresAt = new Date(Date.now() + DURATIONS.SESSION_EXPIRY_MS)

	await db.insert(sessions).values({
		id: sessionId,
		userId: user.id,
		expiresAt,
	})

	// Set session cookie
	setCookie(c, 'session', sessionId, {
		httpOnly: true,
		secure: c.env.ENVIRONMENT === 'production',
		sameSite: 'Lax',
		expires: expiresAt,
		path: '/',
	})

	// Redirect to home
	const frontendUrl = c.env.APP_URL || 'http://localhost:4321'
	return c.redirect(frontendUrl)
})

// Get current user
authRoute.get('/me', async (c) => {
	const sessionId = getCookie(c, 'session')
	if (!sessionId) {
		return c.json({ data: null })
	}

	const db = c.get('db')
	const session = await db.query.sessions.findFirst({
		where: eq(sessions.id, sessionId),
		with: { user: true },
	})

	if (!session || isSessionExpired(session.expiresAt)) {
		deleteCookie(c, 'session')
		return c.json({ data: null })
	}

	return c.json({
		data: {
			id: session.user.id,
			name: session.user.name,
			avatarUrl: session.user.avatarUrl,
		},
	})
})

// Logout
authRoute.post('/logout', (c) => {
	deleteCookie(c, 'session')
	return c.json({ success: true })
})
