---
paths:
  - "apps/api/**"
  - "packages/shared/src/schema/**"
---

# Backend Guidelines

## API Design Principles (Google AIP Inspired)

### Resource-Oriented Design

URLs represent resources, not actions:

```
GET    /api/posts           # List posts
GET    /api/posts/:id       # Get single post
POST   /api/feeds           # Create feed
PUT    /api/feeds/:id       # Update feed (full replace)
PATCH  /api/feeds/:id       # Update feed (partial)
DELETE /api/feeds/:id       # Delete feed
```

### Standard Methods

| Method | HTTP Verb | Description |
|--------|-----------|-------------|
| List | GET | Retrieve collection with pagination |
| Get | GET | Retrieve single resource |
| Create | POST | Create new resource |
| Update | PUT/PATCH | Modify existing resource |
| Delete | DELETE | Remove resource |

### Custom Methods

For non-CRUD operations, use POST with descriptive names:

```
POST /api/feeds/sync        # Sync feeds from source
POST /api/posts/fix-entities # Fix HTML entities
```

## Cursor-Based Pagination

### Why Cursor Over Offset

- **Stable**: No skipped/duplicated items when data changes
- **Performant**: No expensive OFFSET queries
- **Scalable**: Works with real-time data

### Response Format

```typescript
interface CursorResponse<T> {
  data: T[]
  meta: {
    hasMore: boolean
    nextCursor: string | null
    total?: number  // Optional, expensive to compute
  }
}
```

### Cursor Implementation

```typescript
// Standard cursor (date-based)
const cursorCondition = cursor
  ? lt(posts.publishedAt, new Date(cursor))
  : undefined

// Popular sort cursor (composite: count + date)
// Format: "count:isoDateString"
const { count, date } = parsePopularCursor(cursor)
const cursorCondition = or(
  lt(posts.hatenaBookmarkCount, count),
  and(eq(posts.hatenaBookmarkCount, count), lt(posts.publishedAt, date))
)
```

### Pagination Utility

```typescript
// Always fetch limit + 1 to determine hasMore
const result = await db.query.posts.findMany({
  where: conditions,
  limit: limit + 1,
  orderBy: [desc(posts.publishedAt)]
})

return buildCursorResponse(result, limit)  // Handles slicing and cursor building
```

## Request Validation

### Valibot Schemas

Use Valibot for request validation with Hono:

```typescript
import { vValidator } from '@hono/valibot-validator'
import * as v from 'valibot'

const createFeedSchema = v.object({
  feedUrl: v.pipe(v.string(), v.url()),
  title: v.optional(v.pipe(v.string(), v.maxLength(200))),
})

route.post('/', vValidator('json', createFeedSchema), async (c) => {
  const body = c.req.valid('json')  // Typed and validated
  // ...
})
```

### Query Parameter Transforms

```typescript
// Boolean from query string
techOnly: v.optional(
  v.pipe(
    v.string(),
    v.transform((s) => s === 'true'),
  ),
),

// Number from query string
limit: v.optional(
  v.pipe(v.string(), v.transform(Number)),
  '20'  // Default value
),
```

## Error Handling

### Standard Error Response

```typescript
return c.json({ error: 'Resource not found' }, 404)
return c.json({ error: 'Unauthorized' }, 401)
return c.json({ error: 'Validation failed', details: errors }, 400)
```

### HTTP Status Codes

| Code | Usage |
|------|-------|
| 200 | Success |
| 201 | Created |
| 400 | Bad request / validation error |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not found |
| 503 | Service unavailable |

## Database Patterns

### Drizzle ORM Conventions

```typescript
// Query with relations
const result = await db.query.posts.findMany({
  where: conditions,
  with: { feed: { with: { author: true } } },  // Nested relations
  orderBy: [desc(posts.publishedAt)],
  limit: 20,
})

// Updates
await db.update(posts)
  .set({ hatenaBookmarkCount: count })
  .where(eq(posts.id, postId))
```

### ID Generation

Use NanoID for human-readable, collision-resistant IDs:

```typescript
import { generateId } from '../utils/id'

const id = generateId()  // Returns 21-char NanoID
```

## Authentication

### Session-Based Auth

```typescript
// Middleware: getSessionUser (returns user or null)
const user = await getSessionUser(c)
if (!user) {
  return c.json({ error: 'Unauthorized' }, 401)
}

// Middleware: requireAuth (throws if no user)
route.use(requireAuth)
```

### Admin Routes

Protected by `ADMIN_SECRET` header:

```typescript
adminRoute.use('*', async (c, next) => {
  const authHeader = c.req.header('Authorization')
  if (authHeader !== `Bearer ${c.env.ADMIN_SECRET}`) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  await next()
})
```

## Rate Limiting & Subrequests

### Cloudflare Workers Limits

- **Subrequests**: 50/invocation (free tier)
- **Execution time**: 30 seconds (cron), 10ms CPU per request

### Strategies

```typescript
// Batch API calls
const scores = await calculateTechScoresBatch(ai, posts)  // Single API call

// Sequential with rate limiting
for (const post of posts) {
  await fetchOgImage(post.url)
  await new Promise(r => setTimeout(r, 200))  // 200ms delay
}

// Hybrid parallel/sequential
await Promise.all([
  fetchRssFeeds(db, ai),        // Parallel: RSS fetch
  reconcileBookmarkCounts(db),  // Parallel: DB-only
])
await updateRecentBookmarkCounts(db)  // Sequential: Hatena API
```

## File Organization

```
apps/api/src/
├── routes/
│   ├── posts.ts      # GET /posts, /posts/search, /posts/ranking
│   ├── feeds.ts      # CRUD for feeds
│   ├── auth.ts       # GitHub OAuth
│   ├── feed.ts       # User's feed management
│   └── admin.ts      # Admin-only operations
├── services/
│   ├── rss.ts        # RSS parsing, OGP fetching
│   ├── hatena.ts     # Hatena Bookmark API
│   ├── tech-score.ts # Tech score calculation
│   └── feed-sync.ts  # Feed synchronization
├── middleware/
│   └── auth.ts       # Authentication middleware
├── utils/
│   ├── pagination.ts # buildCursorResponse
│   ├── cursor.ts     # Cursor parsing/building
│   ├── date.ts       # Date utilities
│   └── id.ts         # NanoID generation
└── db/
    ├── schema.ts     # Drizzle schema
    └── index.ts      # DB connection
```

## Testing

### Vitest Patterns

```typescript
import { describe, it, expect } from 'vitest'

describe('parsePopularCursor', () => {
  it('parses count and date from cursor string', () => {
    const cursor = '10:2024-01-15T00:00:00.000Z'
    const result = parsePopularCursor(cursor)
    expect(result.count).toBe(10)
    expect(result.date).toEqual(new Date('2024-01-15T00:00:00.000Z'))
  })
})
```

### Test File Naming

- Unit tests: `*.test.ts` alongside source file
- Integration tests: `routes/*.test.ts`
