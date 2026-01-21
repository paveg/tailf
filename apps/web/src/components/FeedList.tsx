/**
 * フィード一覧コンポーネント
 *
 * SSG + クライアントフォールバック方式
 */
import type { FeedWithAuthor } from '@tailf/shared'
import { Bookmark, Building2, ExternalLink, Presentation, Rss, Users } from 'lucide-react'
import {
	useBookmarkedFeeds,
	useBookmarkFeed,
	useCurrentUser,
	useFeeds,
	useUnbookmarkFeed,
} from '@/lib/hooks'
import { useBooleanQueryParam } from '@/lib/useQueryParams'
import { QueryProvider } from './QueryProvider'
import { Button } from './ui/button'
import { Card, CardHeader, CardTitle } from './ui/card'
import { Empty } from './ui/empty'
import { Skeleton } from './ui/skeleton'
import { Toggle } from './ui/toggle'

interface FeedListContentProps {
	initialFeeds: FeedWithAuthor[]
}

function FeedListContent({ initialFeeds }: FeedListContentProps) {
	const [officialOnly, setOfficialOnly] = useBooleanQueryParam('official', false)
	const useClientFetch = initialFeeds.length === 0
	const official = officialOnly ? true : undefined
	const { data, isLoading } = useFeeds({ perPage: 50, official })
	const { data: user } = useCurrentUser()
	const { data: bookmarkedData } = useBookmarkedFeeds()
	const bookmarkFeed = useBookmarkFeed()
	const unbookmarkFeed = useUnbookmarkFeed()

	const bookmarkedFeedIds = new Set(bookmarkedData?.data?.map((f) => f.id) ?? [])

	const apiFeeds = data?.data ?? []
	const feeds: FeedWithAuthor[] = useClientFetch
		? apiFeeds
		: initialFeeds.filter((f) => !officialOnly || f.isOfficial)

	const isInitialLoading = useClientFetch && isLoading

	const handleBookmarkToggle = (feedId: string, isBookmarked: boolean) => {
		if (isBookmarked) {
			unbookmarkFeed.mutate(feedId)
		} else {
			bookmarkFeed.mutate(feedId)
		}
	}

	// フィルタートグル - 常に表示
	const filterToggle = (
		<div className="flex items-center justify-end">
			<Toggle
				variant="outline"
				pressed={officialOnly}
				onPressedChange={setOfficialOnly}
				size="sm"
				className="text-xs"
			>
				<Building2 className={officialOnly ? 'text-primary' : ''} />
				企業ブログ
			</Toggle>
		</div>
	)

	return (
		<div className="space-y-6">
			{/* Filter Toggle */}
			{filterToggle}

			{/* Loading State */}
			{isInitialLoading && (
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{Array.from({ length: 6 }).map((_, i) => (
						<Card key={i} className="h-full">
							<CardHeader>
								<div className="flex items-center justify-between">
									<Skeleton className="h-6 w-32" />
									<Skeleton className="h-5 w-16" />
								</div>
								<Skeleton className="mt-2 h-4 w-24" />
							</CardHeader>
						</Card>
					))}
				</div>
			)}

			{/* Empty State */}
			{!isInitialLoading && feeds.length === 0 && (
				<Empty
					icon={Rss}
					title={officialOnly ? '企業ブログがありません' : 'まだフィードが登録されていません'}
				/>
			)}

			{/* Feed Grid */}
			{!isInitialLoading && feeds.length > 0 && (
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{feeds.map((feed) => {
						const isBookmarked = bookmarkedFeedIds.has(feed.id)
						const bookmarkCount = feed.bookmarkCount ?? 0
						return (
							<Card
								key={feed.id}
								className="group h-full transition-colors hover:border-primary/20 hover:bg-muted/50"
							>
								<CardHeader className="gap-2">
									<div className="flex items-start justify-between gap-2">
										<a
											href={feed.siteUrl}
											target="_blank"
											rel="noopener noreferrer"
											className="min-w-0 flex-1"
										>
											<CardTitle className="line-clamp-2 text-base group-hover:text-primary">
												{feed.title}
											</CardTitle>
										</a>
										<div className="flex shrink-0 items-center gap-1">
											{user && feed.authorId !== user.id && (
												<Button
													variant="ghost"
													size="icon"
													className="size-8"
													onClick={() => handleBookmarkToggle(feed.id, isBookmarked)}
													disabled={bookmarkFeed.isPending || unbookmarkFeed.isPending}
												>
													<Bookmark
														className={`size-4 ${isBookmarked ? 'fill-primary text-primary' : 'text-muted-foreground'}`}
													/>
												</Button>
											)}
										</div>
									</div>
									{feed.description && (
										<p className="line-clamp-2 text-sm text-muted-foreground">{feed.description}</p>
									)}
									<div className="flex items-center justify-between gap-2 overflow-hidden">
										<div className="flex min-w-0 flex-1 items-center gap-2">
											{feed.isOfficial && <Building2 className="size-4 shrink-0 text-primary" />}
											{feed.author && (
												<img
													src={
														feed.author.avatarUrl || `https://github.com/${feed.author.name}.png`
													}
													alt={feed.author.name}
													width={20}
													height={20}
													loading="lazy"
													decoding="async"
													className="size-5 shrink-0 rounded-full"
												/>
											)}
											<span className="truncate text-xs text-muted-foreground">
												{feed.author?.name ?? feed.title}
											</span>
										</div>
										<div className="flex shrink-0 items-center gap-2">
											{/* Feed type badge */}
											{feed.type === 'slide' && (
												<span className="flex items-center gap-1 text-xs text-muted-foreground">
													<Presentation className="size-3" />
												</span>
											)}
											{/* Bookmark count */}
											{bookmarkCount > 0 && (
												<span className="flex items-center gap-1 text-xs text-muted-foreground">
													<Users className="size-3" />
													{bookmarkCount}
												</span>
											)}
										</div>
									</div>
									<div className="flex items-center justify-end">
										<a
											href={feed.siteUrl}
											target="_blank"
											rel="noopener noreferrer"
											className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground/60 hover:text-muted-foreground"
										>
											{new URL(feed.siteUrl).hostname}
											<ExternalLink className="size-3" />
										</a>
									</div>
								</CardHeader>
							</Card>
						)
					})}
				</div>
			)}
		</div>
	)
}

interface FeedListProps {
	initialFeeds?: FeedWithAuthor[]
}

export function FeedList({ initialFeeds = [] }: FeedListProps) {
	return (
		<QueryProvider>
			<FeedListContent initialFeeds={initialFeeds} />
		</QueryProvider>
	)
}
