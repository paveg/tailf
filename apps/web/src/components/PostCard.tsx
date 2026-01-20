import { Calendar, ExternalLink } from 'lucide-react'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { extractDomain, formatDate } from '@/lib/utils'

interface PostCardProps {
	post: {
		id: string
		title: string
		url: string
		publishedAt: string | Date
		thumbnailUrl?: string | null
		blog: {
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
	return (
		<Card className="group transition-colors hover:bg-muted/50">
			<a href={post.url} target="_blank" rel="noopener noreferrer" className="block">
				<CardHeader className="gap-2">
					<div className="flex items-center justify-between text-xs text-muted-foreground">
						<div className="flex items-center gap-1.5">
							<Calendar className="size-3" />
							<time dateTime={new Date(post.publishedAt).toISOString()}>
								{formatDate(post.publishedAt)}
							</time>
						</div>
						<ExternalLink className="size-3 shrink-0" />
					</div>
					<CardTitle className="line-clamp-2 text-base leading-snug group-hover:text-primary break-keep">
						{post.title}
					</CardTitle>
					<div className="flex items-center justify-between gap-2 overflow-hidden">
						<div className="flex items-center gap-2 min-w-0 flex-1">
							{post.blog.author?.avatarUrl && (
								<img
									src={post.blog.author.avatarUrl}
									alt={post.blog.author.name}
									className="size-5 shrink-0 rounded-full"
								/>
							)}
							<span className="truncate text-xs text-muted-foreground">
								{post.blog.author?.name ?? post.blog.title}
							</span>
						</div>
						<span className="shrink-0 truncate text-xs text-muted-foreground/60">
							{extractDomain(post.url)}
						</span>
					</div>
				</CardHeader>
			</a>
		</Card>
	)
}
