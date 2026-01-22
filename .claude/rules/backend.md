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

## Cloudflare Workers Platform

### Resource Limits

| Resource | Free Tier | Paid |
|----------|-----------|------|
| Subrequests | 50/invocation | 1000/invocation |
| CPU time | 10ms/request | 30s/request |
| Cron execution | 30s total | 30s total |
| D1 reads | 5M/day | 25B/month |
| D1 writes | 100K/day | 50M/month |
| Workers AI | 10K neurons/day | Pay-as-you-go |

### Subrequest Counting

Each of these counts as 1 subrequest:
- `fetch()` to external URLs
- D1 database queries
- Workers AI calls
- KV/R2/DO operations

**Critical**: Hitting 50 subrequests = `Error: Too many subrequests`

### D1 (SQLite) Considerations

```typescript
// D1 is SQLite - no native FTS5, use raw SQL
const ftsResult = await db.all<{ id: string }>(sql`
  SELECT p.id FROM posts p
  JOIN posts_fts ON p.rowid = posts_fts.rowid
  WHERE posts_fts MATCH ${query}
  ORDER BY p.published_at DESC
  LIMIT ${limit}
`)

// Batch inserts for efficiency
await db.insert(posts).values(postsToInsert)  // Single query
```

### Durable Objects (DO) - Future Consideration

Currently not used, but available for:
- Real-time collaboration
- Rate limiting with state
- WebSocket connections
- Consistent counters

```typescript
// DO pattern (not currently implemented)
export class RateLimiter {
  async fetch(request: Request) {
    // Stateful rate limiting logic
  }
}
```

## Workers AI & Embeddings

### BGE-M3 Model

Used for tech score calculation via semantic similarity:

```typescript
// Model: @cf/baai/bge-m3
// Output: 1024-dimensional embedding vector
// Languages: Multilingual (Japanese + English)
const result = await ai.run('@cf/baai/bge-m3', {
  text: ['TypeScript React フロントエンド開発']
})
// result.data[0] = number[1024]
```

### Tech Score Architecture

```
Input Text → BGE-M3 Embedding → Cosine Similarity → Score
                                    ↓
                        Tech Anchors (programming, infra, AI...)
                        Non-Tech Anchors (career, diary, gadget...)
```

### Batch Embedding (Subrequest Optimization)

**Problem**: N posts × 1 API call = N subrequests (hits limit fast)

**Solution**: Batch all texts in single API call

```typescript
// Bad: N subrequests
for (const post of posts) {
  const embedding = await ai.run('@cf/baai/bge-m3', { text: [post.title] })
}

// Good: 1 subrequest (+ 2 for anchor embeddings)
const texts = posts.map(p => `${p.title} ${p.summary || ''}`)
const embeddings = await ai.run('@cf/baai/bge-m3', { text: texts })
```

### Fallback Strategy

```typescript
export async function calculateTechScoreWithEmbedding(
  ai: Ai | undefined,
  title: string,
  summary?: string
): Promise<number> {
  // Fallback to keyword-based if AI unavailable
  if (!ai) {
    return calculateTechScore(title, summary)  // Keyword matching
  }

  try {
    // Embedding-based calculation
    const score = await computeEmbeddingScore(ai, title, summary)
    return score
  } catch (error) {
    console.error('[TechScore] Embedding error, falling back to keyword:', error)
    return calculateTechScore(title, summary)  // Graceful degradation
  }
}
```

### Anchor Embedding Cache

```typescript
// Module-level cache (persists within worker instance)
let techAnchorEmbeddings: number[][] | null = null
let nonTechAnchorEmbeddings: number[][] | null = null

async function getAnchorEmbeddings(ai: Ai) {
  if (techAnchorEmbeddings && nonTechAnchorEmbeddings) {
    return { tech: techAnchorEmbeddings, nonTech: nonTechAnchorEmbeddings }
  }

  // Compute once per worker instance
  const [techResult, nonTechResult] = await Promise.all([
    ai.run('@cf/baai/bge-m3', { text: TECH_ANCHOR_PHRASES }),
    ai.run('@cf/baai/bge-m3', { text: NON_TECH_ANCHOR_PHRASES }),
  ])

  techAnchorEmbeddings = techResult.data
  nonTechAnchorEmbeddings = nonTechResult.data

  return { tech: techAnchorEmbeddings, nonTech: nonTechAnchorEmbeddings }
}
```

## Subrequest Management Strategies

### Counting & Planning

Before implementing cron jobs, estimate subrequests:

```
RSS Fetch (30 feeds):     30 fetch() calls
OGP Fetch (10 posts):     10 fetch() calls
Hatena API (20 posts):    20 fetch() calls
Embedding (batch):         3 AI calls (input + 2 anchors)
DB Operations:            ~10 queries
─────────────────────────────────────────
Total:                    ~73 subrequests ❌ Over limit!
```

### Strategies to Stay Under Limit

**1. Batch API Calls**
```typescript
// Single API call for multiple items
const scores = await calculateTechScoresBatch(ai, posts)
```

**2. Hybrid Parallel/Sequential**
```typescript
// Phase 1: Parallel (DB-only operations don't count against external limit)
await Promise.all([
  fetchRssFeeds(db, ai),        // External fetches
  reconcileBookmarkCounts(db),  // DB-only
])

// Phase 2: Sequential (spread external API calls)
await updateRecentBookmarkCounts(db)
```

**3. Rate Limiting with Delays**
```typescript
for (const post of postsToFetch) {
  await fetchOgImage(post.url)
  await new Promise(r => setTimeout(r, 200))  // 200ms between requests
}
```

**4. Limit Per Execution**
```typescript
// Process in batches across multiple cron runs
const OGP_FETCH_LIMIT = 10  // Only 10 per cron execution
const postsToFetch = postsWithoutThumbnails.slice(0, OGP_FETCH_LIMIT)
```

**5. Prioritize and Skip**
```typescript
// Skip non-essential operations when approaching limit
if (subrequestCount > 40) {
  console.warn('Approaching subrequest limit, skipping OGP fetch')
  return
}
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
