/**
 * フィード一覧コンポーネント
 *
 * SSG + クライアントフォールバック方式
 */
import type { Feed } from '@tailf/shared'
import { Building2, ExternalLink, Rss } from 'lucide-react'
import { useFeeds } from '@/lib/hooks'
import { useBooleanQueryParam } from '@/lib/useQueryParams'
import { QueryProvider } from './QueryProvider'
import { Card, CardHeader, CardTitle } from './ui/card'
import { Skeleton } from './ui/skeleton'
import { Toggle } from './ui/toggle'

interface FeedListContentProps {
	initialFeeds: Feed[]
}

function FeedListContent({ initialFeeds }: FeedListContentProps) {
	const [officialOnly, setOfficialOnly] = useBooleanQueryParam('official', false)
	const useClientFetch = initialFeeds.length === 0
	const official = officialOnly ? true : undefined
	const { data, isLoading } = useFeeds({ perPage: 50, official })

	const apiFeeds = data?.data ?? []
	const feeds = useClientFetch
		? apiFeeds
		: initialFeeds.filter((f) => !officialOnly || f.isOfficial)

	const isInitialLoading = useClientFetch && isLoading

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
				<div className="py-12 text-center">
					<div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-muted">
						<Rss className="size-8 text-muted-foreground" />
					</div>
					<p className="text-lg font-medium text-muted-foreground">
						{officialOnly ? '企業ブログがありません' : 'まだフィードが登録されていません'}
					</p>
				</div>
			)}

			{/* Feed Grid */}
			{!isInitialLoading && feeds.length > 0 && (
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{feeds.map((feed) => (
						<a
							key={feed.id}
							href={feed.siteUrl}
							target="_blank"
							rel="noopener noreferrer"
							className="block"
						>
							<Card className="group h-full transition-colors hover:border-primary/20 hover:bg-muted/50">
								<CardHeader className="gap-2">
									<CardTitle className="line-clamp-2 text-base group-hover:text-primary">
										{feed.title}
									</CardTitle>
									{feed.description && (
										<p className="line-clamp-2 text-sm text-muted-foreground">{feed.description}</p>
									)}
									<div className="flex items-center justify-between gap-2 overflow-hidden">
										<div className="flex min-w-0 flex-1 items-center gap-2">
											{feed.author && (
												<img
													src={
														feed.author.avatarUrl || `https://github.com/${feed.author.name}.png`
													}
													alt={feed.author.name}
													className="size-5 shrink-0 rounded-full"
												/>
											)}
											<span className="truncate text-xs text-muted-foreground">
												{feed.author?.name ?? feed.title}
											</span>
										</div>
										<span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground/60">
											{new URL(feed.siteUrl).hostname}
											<ExternalLink className="size-3" />
										</span>
									</div>
								</CardHeader>
							</Card>
						</a>
					))}
				</div>
			)}
		</div>
	)
}

interface FeedListProps {
	initialFeeds?: Feed[]
}

export function FeedList({ initialFeeds = [] }: FeedListProps) {
	return (
		<QueryProvider>
			<FeedListContent initialFeeds={initialFeeds} />
		</QueryProvider>
	)
}
