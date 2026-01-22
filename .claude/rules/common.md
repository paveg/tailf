---
paths:
  - "**/*"
---

# Common Guidelines

## Monorepo Structure

### Package Boundaries

```
tailf/
├── apps/
│   ├── api/     # Backend - Cloudflare Workers
│   └── web/     # Frontend - Astro SSG
└── packages/
    └── shared/  # Types & schemas shared between apps
```

### Dependency Rules

| From | Can Import |
|------|------------|
| `apps/api` | `packages/shared` |
| `apps/web` | `packages/shared` |
| `packages/shared` | External packages only |

**Never import across apps** (api → web or web → api)

### Shared Package Usage

```typescript
// Types shared between frontend and backend
import type { PostWithFeed, Feed, User } from '@tailf/shared'

// Validation schemas used by both
import { cursorPaginationQuerySchema } from '@tailf/shared'
```

## DRY Principles

### What to Share

| Share | Example |
|-------|---------|
| Types | `PostWithFeed`, `Feed`, `User` |
| Validation schemas | `cursorPaginationQuerySchema` |
| Constants | Tech score thresholds, limits |

### What NOT to Share

| Keep Separate | Reason |
|---------------|--------|
| API client logic | Frontend-only concern |
| Database queries | Backend-only concern |
| UI components | Frontend-only concern |
| Business logic | May diverge per context |

### Duplication is OK When

- Code serves different purposes in different contexts
- Premature abstraction would create tight coupling
- Less than 3 instances of similar code

## Separation of Concerns

### Layer Architecture

```
┌─────────────────────────────────────┐
│ Routes (HTTP handling)              │  ← Thin layer: validation, response
├─────────────────────────────────────┤
│ Services (Business logic)           │  ← Core logic, reusable
├─────────────────────────────────────┤
│ Database (Drizzle ORM)              │  ← Data access
└─────────────────────────────────────┘
```

### Route Responsibility

```typescript
// Good: Routes handle HTTP concerns only
postsRoute.get('/', vValidator('query', schema), async (c) => {
  const params = c.req.valid('query')
  const db = c.get('db')

  const result = await fetchPosts(db, params)  // Delegate to service

  return c.json(buildCursorResponse(result, params.limit))
})

// Bad: Business logic in route
postsRoute.get('/', async (c) => {
  // 50 lines of database queries and transformations...
})
```

### Service Responsibility

```typescript
// services/rss.ts
export async function fetchRssFeeds(db: Database, ai?: Ai): Promise<void>
export async function fetchOgImage(url: string): Promise<string | null>
export function parseFeed(xml: string): RssFeed | null
```

## Abstraction Guidelines

### Right Level of Abstraction

```typescript
// Too abstract: What does this do?
processData(input, options)

// Too concrete: Hardcoded for specific use case
getPostsWithHatenaBookmarkCountGreaterThan10SortedByDate()

// Just right: Clear purpose, configurable
async function getPostsByPopularity(
  db: Database,
  minBookmarks: number,
  period: 'week' | 'month'
): Promise<Post[]>
```

### Extract When

1. **3+ duplications** with identical logic
2. **Clear single responsibility** can be named
3. **Testability improves** with extraction
4. **Cognitive load decreases** with extraction

### Don't Extract When

1. Only 2 similar instances
2. Logic likely to diverge
3. Extraction creates indirection without benefit
4. Would require many parameters

## Naming Conventions

### Files

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `PostCard.tsx` |
| Hooks | camelCase with use prefix | `useDebounce.ts` |
| Utils | camelCase | `pagination.ts` |
| Types | camelCase | `types/index.ts` |
| Tests | same name + .test | `pagination.test.ts` |

### Functions

```typescript
// Queries: get*, fetch*, find*
getPostById(id)
fetchRssFeeds(db)
findUserByGitHubId(id)

// Mutations: create*, update*, delete*
createFeed(data)
updatePost(id, data)
deleteFeed(id)

// Transformations: parse*, build*, format*
parseFeed(xml)
buildCursorResponse(data, limit)
formatDate(date)

// Predicates: is*, has*, can*
isTechPost(title, summary)
hasMore(results, limit)
canEditFeed(user, feed)
```

### Variables

```typescript
// Boolean: is*, has*, should*, can*
const isLoading = true
const hasMore = results.length > limit

// Arrays: plural nouns
const posts = []
const feedIds = []

// Maps/Sets: suffix with Map/Set
const feedUrlMap = new Map<string, string>()
const processedIdSet = new Set<string>()
```

## Error Handling

### Fail Fast

```typescript
// Good: Early return on invalid state
if (!user) {
  return c.json({ error: 'Unauthorized' }, 401)
}

// Bad: Deeply nested conditionals
if (user) {
  if (user.canEdit) {
    if (feed.authorId === user.id) {
      // actual logic buried here
    }
  }
}
```

### Graceful Degradation

```typescript
// Fallback pattern
let result = await fetchRanking('week')
if (result.length === 0) {
  result = await fetchRanking('month')  // Fallback to broader period
}

// Try-catch with fallback
try {
  const score = await calculateWithEmbedding(ai, text)
  return score
} catch {
  return calculateWithKeywords(text)  // Fallback to simpler method
}
```

## Performance Mindset

### Database Queries

```typescript
// Good: Fetch only needed columns
const feedIds = await db.query.feeds.findMany({
  where: eq(feeds.isOfficial, true),
  columns: { id: true },  // Only fetch id
})

// Bad: Fetch all columns when not needed
const feeds = await db.query.feeds.findMany({
  where: eq(feeds.isOfficial, true),
})
const feedIds = feeds.map(f => f.id)
```

### Avoid N+1 Queries

```typescript
// Good: Single query with relations
const posts = await db.query.posts.findMany({
  with: { feed: { with: { author: true } } },
})

// Bad: Loop with individual queries
const posts = await db.query.posts.findMany()
for (const post of posts) {
  post.feed = await db.query.feeds.findFirst({ where: eq(feeds.id, post.feedId) })
}
```

### Batch Operations

```typescript
// Good: Batch embedding API call
const texts = posts.map(p => `${p.title} ${p.summary}`)
const embeddings = await ai.run('@cf/baai/bge-m3', { text: texts })

// Bad: Individual API calls
for (const post of posts) {
  const embedding = await ai.run('@cf/baai/bge-m3', { text: [post.title] })
}
```

## Documentation

### Code Comments

```typescript
// Good: Explain WHY, not WHAT
// Fetch limit + 1 to determine if there are more results
const result = await db.query.posts.findMany({ limit: limit + 1 })

// Bad: Describes obvious code
// Add 1 to limit
const result = await db.query.posts.findMany({ limit: limit + 1 })
```

### JSDoc for Public APIs

```typescript
/**
 * Build cursor-based pagination response
 * @param results - Query results (should be limit + 1 items)
 * @param limit - Requested page size
 * @param sortType - Sort type for cursor generation
 * @returns Response with data and pagination meta
 */
export function buildCursorResponse<T>(
  results: T[],
  limit: number,
  sortType?: 'recent' | 'popular'
): CursorResponse<T>
```
