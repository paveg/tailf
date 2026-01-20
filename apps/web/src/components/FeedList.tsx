/**
 * フィード一覧コンポーネント
 *
 * SSG + クライアントフォールバック方式
 */
import type { Feed } from '@tailf/shared'
import { Rss } from 'lucide-react'
import { useFeeds } from '@/lib/hooks'
import { QueryProvider } from './QueryProvider'
import { Card, CardHeader, CardTitle } from './ui/card'
import { Skeleton } from './ui/skeleton'

interface FeedListContentProps {
	initialFeeds: Feed[]
}

function FeedListContent({ initialFeeds }: FeedListContentProps) {
	const useClientFetch = initialFeeds.length === 0
	const { data, isLoading } = useFeeds({ perPage: 50 })

	const apiFeeds = data?.data ?? []
	const feeds = useClientFetch ? apiFeeds : initialFeeds

	if (useClientFetch && isLoading) {
		return (
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
		)
	}

	if (feeds.length === 0) {
		return (
			<div className="py-12 text-center">
				<div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-muted">
					<Rss className="size-8 text-muted-foreground" />
				</div>
				<p className="text-lg font-medium text-muted-foreground">
					まだフィードが登録されていません
				</p>
			</div>
		)
	}

	return (
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
						<CardHeader>
							<div className="flex items-start justify-between gap-2">
								<div className="min-w-0 flex-1">
									<CardTitle className="truncate text-base group-hover:text-primary">
										{feed.title}
									</CardTitle>
									{feed.description && (
										<p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
											{feed.description}
										</p>
									)}
								</div>
								{feed.author && (
									<img
										src={feed.author.avatarUrl || `https://github.com/${feed.author.name}.png`}
										alt={feed.author.name}
										className="size-8 shrink-0 rounded-full"
									/>
								)}
							</div>
							<p className="mt-2 text-xs text-muted-foreground">{new URL(feed.siteUrl).hostname}</p>
						</CardHeader>
					</Card>
				</a>
			))}
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
