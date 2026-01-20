import { Bookmark, Calendar, ExternalLink } from 'lucide-react'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { extractDomain, formatDate } from '@/lib/utils'

interface PostCardProps {
	post: {
		id: string
		title: string
		url: string
		publishedAt: string | Date
		thumbnailUrl?: string | null
		hatenaBookmarkCount?: number | null
		feed: {
			title: string
			siteUrl: string
			author?: {
				name: string
				avatarUrl?: string | null
			} | null
		}
	}
}

export function PostCard({ post }: PostCardProps) {
	const bookmarkCount = post.hatenaBookmarkCount ?? 0
	const isPopular = bookmarkCount >= 10

	return (
		<Card
			className={`group overflow-hidden transition-colors hover:bg-muted/50 ${post.thumbnailUrl ? 'pt-0' : ''}`}
		>
			<a href={post.url} target="_blank" rel="noopener noreferrer" className="block">
				{post.thumbnailUrl && (
					<div className="aspect-[2/1] w-full overflow-hidden border-b bg-muted mb-2">
						<img
							src={post.thumbnailUrl}
							alt=""
							loading="lazy"
							decoding="async"
							className="size-full object-cover"
						/>
					</div>
				)}
				<CardHeader className="gap-2">
					<div className="flex items-center justify-between text-xs text-muted-foreground">
						<div className="flex items-center gap-3">
							<div className="flex items-center gap-1.5">
								<Calendar className="size-3" />
								<time dateTime={new Date(post.publishedAt).toISOString()}>
									{formatDate(post.publishedAt)}
								</time>
							</div>
							{bookmarkCount > 0 && (
								<div
									className={`flex items-center gap-1 ${isPopular ? 'text-orange-500 dark:text-orange-400' : ''}`}
								>
									<Bookmark className="size-3" />
									<span className={isPopular ? 'font-medium' : ''}>{bookmarkCount}</span>
								</div>
							)}
						</div>
					</div>
					<CardTitle className="line-clamp-2 text-base leading-snug group-hover:text-primary break-keep">
						{post.title}
					</CardTitle>
					<div className="flex items-center justify-between gap-2 overflow-hidden">
						<div className="flex min-w-0 flex-1 items-center gap-2">
							{post.feed.author?.avatarUrl && (
								<img
									src={post.feed.author.avatarUrl}
									alt={post.feed.author.name}
									width={20}
									height={20}
									loading="lazy"
									decoding="async"
									className="size-5 shrink-0 rounded-full"
								/>
							)}
							<span className="truncate text-xs text-muted-foreground">
								{post.feed.author?.name ?? post.feed.title}
							</span>
						</div>
						<span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground/60">
							{extractDomain(post.url)}
							<ExternalLink className="size-3" />
						</span>
					</div>
				</CardHeader>
			</a>
		</Card>
	)
}
