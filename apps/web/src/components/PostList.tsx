/**
 * 記事一覧コンポーネント
 *
 * 現在の方式: 全件SSG + クライアント側ページネーション
 * - allPosts: ビルド時に取得した全記事
 * - visibleCount: 表示件数（スクロールで増加）
 * - 検索のみAPIコール
 *
 * 開発環境ではSSGデータがない場合、クライアントサイドでAPIを叩く
 *
 * 12件SSG + API方式に切り替える場合:
 * - allPosts → initialData (CursorResponse型) に変更
 * - useInfinitePosts(12, techOnly, initialData) を使用
 * - visibleCount/filteredPosts のロジックを削除
 */
import type { PostWithFeed } from '@tailf/shared'
import { Building2, Code2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { SortOption } from '@/lib/api'
import { useInfinitePosts, useInfiniteSearchPosts } from '@/lib/hooks'
import { useDebounce } from '@/lib/useDebounce'
import { useIntersectionObserver } from '@/lib/useIntersectionObserver'
import { useBooleanQueryParam, useStringQueryParam } from '@/lib/useQueryParams'
import { PostCard } from './PostCard'
import { QueryProvider } from './QueryProvider'
import { SearchInput } from './SearchInput'
import { Button } from './ui/button'
import { Skeleton } from './ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from './ui/tabs'
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group'

const POSTS_PER_PAGE = 12

interface PostListContentProps {
	allPosts: PostWithFeed[]
}

const SORT_OPTIONS = ['recent', 'popular'] as const

function PostListContent({ allPosts }: PostListContentProps) {
	const [searchQuery, setSearchQuery] = useState('')
	const [techOnly, setTechOnly] = useBooleanQueryParam('tech', true)
	const [officialOnly, setOfficialOnly] = useBooleanQueryParam('official', false)
	const [sort, setSort] = useStringQueryParam<SortOption>('sort', 'recent', SORT_OPTIONS)
	const [visibleCount, setVisibleCount] = useState(POSTS_PER_PAGE)
	const debouncedQuery = useDebounce(searchQuery, 300)

	const isSearching = debouncedQuery.length >= 2

	// SSGデータがない場合（開発環境）はAPIから取得
	const useClientFetch = allPosts.length === 0
	const official = officialOnly ? true : undefined
	const apiQuery = useInfinitePosts(12, techOnly, official, sort)

	// Search uses API (can't pre-build search results)
	const searchQueryResult = useInfiniteSearchPosts(debouncedQuery, 12, techOnly, official)

	// APIから取得した記事（開発環境用）
	const apiPosts = useMemo(() => {
		return apiQuery.data?.pages.flatMap((page) => page.data) ?? []
	}, [apiQuery.data])

	// 使用する記事データ（SSG or API）
	const sourcePosts = useClientFetch ? apiPosts : allPosts

	// Filter and sort posts client-side
	const filteredPosts = useMemo(() => {
		let posts = sourcePosts
		if (techOnly && !useClientFetch) {
			// SSGの場合はクライアントでフィルタ
			posts = posts.filter((post) => (post.techScore ?? 0) >= 0.3)
		}
		// SSGの場合はクライアントでソート
		if (!useClientFetch && sort === 'popular') {
			posts = [...posts].sort((a, b) => {
				const aCount = a.hatenaBookmarkCount ?? 0
				const bCount = b.hatenaBookmarkCount ?? 0
				if (bCount !== aCount) return bCount - aCount
				return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
			})
		}
		return posts
	}, [sourcePosts, techOnly, useClientFetch, sort])

	// Visible posts (client-side pagination for SSG)
	const visiblePosts = useMemo(() => {
		if (useClientFetch) {
			return filteredPosts // APIの場合は既にページネーション済み
		}
		return filteredPosts.slice(0, visibleCount)
	}, [filteredPosts, visibleCount, useClientFetch])

	const hasMore = useClientFetch
		? (apiQuery.hasNextPage ?? false)
		: visibleCount < filteredPosts.length

	const { ref, isIntersecting } = useIntersectionObserver<HTMLDivElement>({
		rootMargin: '200px',
	})

	// Load more when sentinel is visible
	useEffect(() => {
		if (isSearching) return
		if (!isIntersecting || !hasMore) return

		if (useClientFetch) {
			// API経由の場合
			if (!apiQuery.isFetchingNextPage) {
				apiQuery.fetchNextPage()
			}
		} else {
			// SSGの場合
			setVisibleCount((prev) => prev + POSTS_PER_PAGE)
		}
	}, [isIntersecting, hasMore, isSearching, useClientFetch, apiQuery])

	// Load more for search results
	useEffect(() => {
		if (
			isSearching &&
			isIntersecting &&
			searchQueryResult.hasNextPage &&
			!searchQueryResult.isFetchingNextPage
		) {
			searchQueryResult.fetchNextPage()
		}
	}, [
		isSearching,
		isIntersecting,
		searchQueryResult.hasNextPage,
		searchQueryResult.isFetchingNextPage,
		searchQueryResult.fetchNextPage,
	])

	// Reset visible count when filter/sort changes
	// biome-ignore lint/correctness/useExhaustiveDependencies: filters are intentionally triggers to reset pagination
	useEffect(() => {
		setVisibleCount(POSTS_PER_PAGE)
	}, [techOnly, officialOnly, sort])

	// Determine which posts to show
	const displayPosts = isSearching
		? (searchQueryResult.data?.pages.flatMap((page) => page.data) ?? [])
		: visiblePosts

	const isInitialLoading = useClientFetch && apiQuery.isLoading
	const showSearchLoading = isSearching && searchQueryResult.isLoading
	const isLoadingMore = isSearching
		? searchQueryResult.isFetchingNextPage
		: useClientFetch && apiQuery.isFetchingNextPage
	const showEndMessage = isSearching
		? !searchQueryResult.hasNextPage && displayPosts.length > 0
		: !hasMore && displayPosts.length > 0

	return (
		<div className="space-y-6">
			{/* Search Input and Controls */}
			<div className="space-y-3">
				{/* Search Input */}
				<SearchInput value={searchQuery} onChange={setSearchQuery} isLoading={showSearchLoading} />

				{/* Sort and Filters - single row */}
				<div className="flex items-center justify-between gap-3">
					{/* Sort Tabs */}
					<Tabs value={sort} onValueChange={(v) => setSort(v as SortOption)}>
						<TabsList className="h-8">
							<TabsTrigger value="recent" className="px-3 text-xs">
								新着
							</TabsTrigger>
							<TabsTrigger value="popular" className="px-3 text-xs">
								人気
							</TabsTrigger>
						</TabsList>
					</Tabs>

					{/* Filters */}
					<ToggleGroup
						type="multiple"
						variant="outline"
						size="sm"
						value={[...(techOnly ? ['tech'] : []), ...(officialOnly ? ['official'] : [])]}
						onValueChange={(value) => {
							setTechOnly(value.includes('tech'))
							setOfficialOnly(value.includes('official'))
						}}
					>
						<ToggleGroupItem value="tech" className="text-xs">
							<Code2 className={techOnly ? 'text-primary' : ''} />
							技術記事
						</ToggleGroupItem>
						<ToggleGroupItem value="official" className="text-xs">
							<Building2 className={officialOnly ? 'text-primary' : ''} />
							企業ブログ
						</ToggleGroupItem>
					</ToggleGroup>
				</div>
			</div>

			{/* Initial Loading */}
			{(isInitialLoading || showSearchLoading) && (
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{Array.from({ length: 6 }).map((_, i) => (
						<PostCardSkeleton key={i} />
					))}
				</div>
			)}

			{/* Error State (search only) */}
			{isSearching && searchQueryResult.error && (
				<div className="py-8 text-center text-muted-foreground">
					検索に失敗しました
					<Button variant="link" onClick={() => searchQueryResult.refetch()} className="ml-2">
						再試行
					</Button>
				</div>
			)}

			{/* Empty State */}
			{!isInitialLoading && !showSearchLoading && displayPosts.length === 0 && (
				<div className="py-8 text-center text-muted-foreground">
					{isSearching ? '検索結果がありません' : 'まだ記事がありません'}
				</div>
			)}

			{/* Posts Grid */}
			{displayPosts.length > 0 && (
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{displayPosts.map((post) => (
						<PostCard key={post.id} post={post} />
					))}
				</div>
			)}

			{/* Loading More Skeleton */}
			{isLoadingMore && (
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{Array.from({ length: 3 }).map((_, i) => (
						<PostCardSkeleton key={`loading-${i}`} />
					))}
				</div>
			)}

			{/* Intersection Observer Sentinel */}
			<div ref={ref} className="h-1" />

			{/* End of list indicator */}
			{showEndMessage && (
				<p className="text-center text-sm text-muted-foreground">すべての記事を表示しました</p>
			)}
		</div>
	)
}

function PostCardSkeleton() {
	return (
		<div className="rounded-lg border p-4">
			<div className="mb-2 flex items-center gap-2">
				<Skeleton className="size-6 rounded-full" />
				<Skeleton className="h-4 w-20" />
			</div>
			<Skeleton className="mb-2 h-5 w-full" />
			<Skeleton className="h-5 w-3/4" />
		</div>
	)
}

interface PostListProps {
	allPosts?: PostWithFeed[]
}

export function PostList({ allPosts = [] }: PostListProps) {
	return (
		<QueryProvider>
			<PostListContent allPosts={allPosts} />
		</QueryProvider>
	)
}
