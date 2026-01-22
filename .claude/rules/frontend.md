---
paths:
  - "apps/web/**"
  - "packages/shared/src/types/**"
---

# Frontend Guidelines

## Design Philosophy

### UX-First Principles

1. **Content Over Chrome**: UI should serve the content (tech articles), not distract from it
2. **Clarity Over Cleverness**: Prefer obvious, predictable interactions
3. **Speed Over Animation**: Prioritize perceived performance; animations must be functional
4. **Mobile-First**: Design for mobile, enhance for desktop

### SSG/SEO First Strategy

**Default: Server-Side Generation (SSG)**
- All public pages should have SSG data for SEO
- Build-time data fetching via `server-api.ts`
- HTML contains full content for crawlers

**Client-Side Fetching: Only When Necessary**

| Use Client Fetch When | Example |
|----------------------|---------|
| User-specific data | Bookmarked posts, user feed |
| Real-time updates | Ranking that changes frequently |
| Search results | Cannot pre-build all queries |
| Authenticated actions | Create/update/delete operations |

```astro
---
// SSG: Fetch at build time for SEO
const allPosts = await fetchAllPostsForSSG()
const initialPosts = allPosts.slice(0, 6)
---

<!-- Pass SSG data to React component -->
<RecentPosts client:load initialPosts={initialPosts} />
```

```tsx
// Component: Use SSG data first, API as fallback
function RecentPostsContent({ initialPosts }) {
  const useClientFetch = initialPosts.length === 0  // Dev環境のみ
  const { data } = useInfinitePosts(6)

  const posts = useClientFetch ? apiPosts : initialPosts
  // ...
}
```

### Core Web Vitals Priority

| Metric | Target | Strategy |
|--------|--------|----------|
| LCP | < 2.5s | SSG, image optimization, preload critical resources |
| CLS | < 0.1 | Skeleton structure must match actual component |
| INP | < 200ms | `client:idle`/`client:visible` for non-critical islands |

## Component Architecture

### Astro + React Islands

```
┌─────────────────────────────────────────┐
│ Layout.astro (Static HTML)              │
│  ├── Header (Static nav links)          │
│  │    ├── MobileNav (client:idle)       │
│  │    └── UserMenu (client:idle)        │
│  ├── Main                               │
│  │    └── [Page Content]                │
│  └── Footer (Static)                    │
└─────────────────────────────────────────┘
```

### Hydration Strategy

| Directive | Use When | SSG Data Required |
|-----------|----------|-------------------|
| `client:load` | Interactive main content | Yes (for SEO) |
| `client:idle` | Header/footer, notifications | No (non-SEO content) |
| `client:visible` | Below-fold content | **Yes** (must have SSG) |

**Critical Rules**:
- `client:visible` without SSG data = SEO invisible (Google won't see it)
- Components with API-only data (no SSG) must use `client:load`
- Heading tags (`<h2>`) should be in Astro template, not React component

### QueryClient Singleton

All React islands share a singleton QueryClient to enable cache sharing:

```typescript
// lib/queryClient.ts - singleton instance
// components/QueryProvider.tsx - wraps each island
```

This ensures `/api/auth/me` is called once, not per-island.

## Styling Conventions

### Design System: GitHub Primer

- **Colors**: `global.css` defines OKLCH color tokens
- **Spacing**: 4px base scale (1=4px, 2=8px, 3=12px, 4=16px...)
- **Typography**: Zen Kaku Gothic New (JP), Inter (EN), JetBrains Mono (code)

### shadcn/ui Rules

1. **Minimal CSS overrides** - prefer as-is; override only when necessary for UX
2. **Configure via CSS variables** first, custom classes as fallback
3. **Import from `@/components/ui/*`**
4. **Prefer composition** over prop drilling

```tsx
// Preferred: Use CSS variables in global.css
:root {
  --radius: 0.375rem;
}

// Acceptable: className override when needed
<Button className="h-9 sm:h-8" />

// Avoid: Inline style overrides
<Button style={{ height: '36px' }} />
```

### Tailwind v4 Conventions

```tsx
// Good: Use semantic tokens
className="bg-background text-foreground border-border"

// Bad: Hardcoded colors
className="bg-white text-gray-900 border-gray-200"
```

### Japanese Typography

Pre-configured in `global.css`:
- `line-break: strict` - Kinsoku (禁則処理)
- `text-wrap: balance` - For headings
- `text-wrap: pretty` - For paragraphs
- `break-keep` utility - For word protection

## Component Patterns

### Skeleton Components (CLS Prevention)

**Must match actual component structure:**

```tsx
// PostCardSkeleton - matches PostCard exactly
<div className="overflow-hidden rounded-lg border">
  <Skeleton className="aspect-[2/1] w-full" />  {/* Thumbnail */}
  <div className="space-y-2 p-4">
    <Skeleton className="h-4 w-16" />           {/* Date */}
    <Skeleton className="h-5 w-full" />         {/* Title line 1 */}
    <Skeleton className="h-5 w-3/4" />          {/* Title line 2 */}
    <div className="flex items-center gap-2">
      <Skeleton className="size-5 rounded-full" /> {/* Avatar */}
      <Skeleton className="h-4 w-24" />           {/* Author */}
    </div>
  </div>
</div>
```

### Image Loading

```tsx
// PostCard image
<img
  src={thumbnailUrl}
  alt=""
  loading="lazy"
  decoding="async"
  className="size-full object-cover"
/>

// Avatar with explicit dimensions
<img
  src={avatarUrl}
  width={20}
  height={20}
  loading="lazy"
  decoding="async"
  className="rounded-full"
/>
```

### Error States

Use `sonner` for toast notifications:

```tsx
import { toast } from 'sonner'

// Success
toast.success('フィードを登録しました')

// Error
toast.error('登録に失敗しました')
```

## State Management

### React Query Conventions

```typescript
// Naming: use[Resource][Action]
export function useCurrentUser() { ... }
export function useInfinitePosts(limit: number) { ... }
export function useCreateFeed() { ... }  // mutation

// Stale time: 60 seconds (configured in queryClient.ts)
```

### URL State via Query Params

```typescript
// Use custom hooks for URL state
const [techOnly, setTechOnly] = useBooleanQueryParam('tech', true)
const [sort, setSort] = useStringQueryParam('sort', 'recent', SORT_OPTIONS)
```

## Accessibility

- All interactive elements must be keyboard accessible
- Images with content meaning need descriptive alt text
- Decorative images use `alt=""`
- Color contrast: WCAG AA minimum
- Focus indicators: Use `outline-ring/50` (configured globally)

## File Organization

```
components/
├── ui/           # shadcn/ui primitives (DO NOT MODIFY)
├── icons/        # Custom SVG icons
├── PostCard.tsx  # Feature components
├── PostList.tsx
└── QueryProvider.tsx

lib/
├── api.ts        # API client functions
├── hooks.ts      # React Query hooks
├── queryClient.ts # Singleton QueryClient
├── utils.ts      # Utility functions
└── use*.ts       # Custom hooks
```
