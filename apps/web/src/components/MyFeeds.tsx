import { Bookmark, ExternalLink, Loader2, Plus, Rss, Trash2, Users } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import {
	useBookmarkedFeeds,
	useCurrentUser,
	useDeleteFeed,
	useMyFeeds,
	useRegisterFeed,
	useUnbookmarkFeed,
} from '@/lib/hooks'
import { QueryProvider } from './QueryProvider'
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from './ui/alert-dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'

function MyFeedsContent() {
	const { data: user, isLoading: userLoading } = useCurrentUser()
	const { data: feedsData, isLoading: feedsLoading } = useMyFeeds()
	const { data: bookmarkedData, isLoading: bookmarkedLoading } = useBookmarkedFeeds()
	const deleteFeed = useDeleteFeed()
	const registerFeed = useRegisterFeed()
	const unbookmarkFeed = useUnbookmarkFeed()
	const [feedUrl, setFeedUrl] = useState('')
	const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null)
	const [unbookmarkTarget, setUnbookmarkTarget] = useState<{ id: string; title: string } | null>(
		null,
	)

	if (userLoading) {
		return (
			<div className="flex min-h-[400px] items-center justify-center">
				<Loader2 className="size-8 animate-spin text-muted-foreground" />
			</div>
		)
	}

	if (!user) {
		return (
			<div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-card to-muted/30 p-8 text-center">
				<div className="absolute -right-8 -top-8 size-32 rounded-full bg-primary/5" />
				<div className="absolute -bottom-4 -left-4 size-24 rounded-full bg-primary/5" />
				<div className="relative">
					<div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl bg-primary/10">
						<Rss className="size-8 text-primary" />
					</div>
					<h2 className="mb-2 text-xl font-semibold">フィードを登録しよう</h2>
					<p className="mx-auto mb-6 max-w-sm text-muted-foreground">
						GitHubでログインすると、あなたの技術ブログやスライドをtailfに登録できます
					</p>
					<Button asChild size="lg" className="gap-2">
						<a href="/api/auth/github">
							<svg
								className="size-5"
								viewBox="0 0 24 24"
								fill="currentColor"
								aria-label="GitHub"
								role="img"
							>
								<path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
							</svg>
							GitHubでログイン
						</a>
					</Button>
				</div>
			</div>
		)
	}

	const feeds = feedsData?.data ?? []
	const bookmarkedFeeds = bookmarkedData?.data ?? []

	const handleRegister = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!feedUrl.trim()) return

		try {
			await registerFeed.mutateAsync({ feedUrl: feedUrl.trim() })
			setFeedUrl('')
			toast.success('フィードを登録しました')
		} catch (error) {
			let message = 'フィードの登録に失敗しました'
			if (error instanceof Error) {
				if (error.message.includes('already registered')) {
					message = 'このフィードは既に登録されています'
				} else if (error.message.includes('Invalid')) {
					message = 'RSSフィードの取得に失敗しました。URLを確認してください'
				} else {
					message = error.message
				}
			}
			toast.error(message)
		}
	}

	const handleDeleteClick = (feedId: string, feedTitle: string) => {
		setDeleteTarget({ id: feedId, title: feedTitle })
	}

	const handleDeleteConfirm = async () => {
		if (!deleteTarget) return

		try {
			await deleteFeed.mutateAsync(deleteTarget.id)
			setDeleteTarget(null)
			toast.success('フィードを削除しました')
		} catch (error) {
			const message = error instanceof Error ? error.message : '削除に失敗しました'
			toast.error(message)
		}
	}

	const handleUnbookmarkClick = (feedId: string, feedTitle: string) => {
		setUnbookmarkTarget({ id: feedId, title: feedTitle })
	}

	const handleUnbookmarkConfirm = async () => {
		if (!unbookmarkTarget) return

		try {
			await unbookmarkFeed.mutateAsync(unbookmarkTarget.id)
			setUnbookmarkTarget(null)
			toast.success('ブックマークを解除しました')
		} catch (error) {
			const message = error instanceof Error ? error.message : 'ブックマーク解除に失敗しました'
			toast.error(message)
		}
	}

	return (
		<div className="space-y-8">
			{/* 登録フォーム */}
			<div className="group relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/5 via-card to-card p-6 transition-all hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5">
				<div className="absolute -right-12 -top-12 size-40 rounded-full bg-primary/5 transition-transform group-hover:scale-110" />
				<div className="relative">
					<div className="mb-4 flex items-center gap-3">
						<div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
							<Plus className="size-5 text-primary" />
						</div>
						<div>
							<h2 className="font-semibold">新しいフィードを登録</h2>
							<p className="text-xs text-muted-foreground">RSS/Atomフィードに対応</p>
						</div>
					</div>
					<form onSubmit={handleRegister} className="flex gap-2">
						<div className="flex-1">
							<Label htmlFor="feedUrl" className="sr-only">
								RSSフィードURL
							</Label>
							<Input
								id="feedUrl"
								type="url"
								placeholder="https://example.com/feed.xml"
								value={feedUrl}
								onChange={(e) => setFeedUrl(e.target.value)}
								className="h-11 border-muted-foreground/20 bg-background/50 backdrop-blur-sm transition-colors focus:border-primary"
								required
							/>
						</div>
						<Button
							type="submit"
							disabled={registerFeed.isPending || !feedUrl.trim()}
							className="h-11 gap-2 px-6"
						>
							{registerFeed.isPending ? (
								<Loader2 className="size-4 animate-spin" />
							) : (
								<Rss className="size-4" />
							)}
							{registerFeed.isPending ? '登録中' : '登録'}
						</Button>
					</form>
				</div>
			</div>

			{/* タブで登録済み/ブックマーク切り替え */}
			<Tabs defaultValue="registered" className="w-full">
				<TabsList className="grid w-full grid-cols-2">
					<TabsTrigger value="registered" className="gap-2">
						<Rss className="size-4" />
						登録済み
						{feeds.length > 0 && (
							<span className="rounded-full bg-muted px-2 py-0.5 text-xs">{feeds.length}</span>
						)}
					</TabsTrigger>
					<TabsTrigger value="bookmarked" className="gap-2">
						<Bookmark className="size-4" />
						ブックマーク
						{bookmarkedFeeds.length > 0 && (
							<span className="rounded-full bg-muted px-2 py-0.5 text-xs">
								{bookmarkedFeeds.length}
							</span>
						)}
					</TabsTrigger>
				</TabsList>

				{/* 登録済みフィード */}
				<TabsContent value="registered" className="mt-6">
					{feedsLoading ? (
						<div className="flex items-center justify-center py-12">
							<Loader2 className="size-6 animate-spin text-muted-foreground" />
						</div>
					) : feeds.length === 0 ? (
						<div className="relative overflow-hidden rounded-2xl border border-dashed border-muted-foreground/20 bg-muted/30 p-12 text-center">
							<div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />
							<div className="relative">
								<div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-muted">
									<Rss className="size-8 text-muted-foreground" />
								</div>
								<p className="text-lg font-medium text-muted-foreground">
									まだフィードを登録していません
								</p>
								<p className="mt-1 text-sm text-muted-foreground/70">
									上のフォームからRSSフィードURLを入力して登録しましょう
								</p>
							</div>
						</div>
					) : (
						<div className="grid gap-4">
							{feeds.map((feed, index) => (
								<div
									key={feed.id}
									className="group relative overflow-hidden rounded-xl border bg-card p-5 transition-all hover:border-primary/20 hover:shadow-md"
									style={{ animationDelay: `${index * 50}ms` }}
								>
									<div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
									<div className="relative flex items-start justify-between gap-4">
										<div className="min-w-0 flex-1">
											<div className="flex items-center gap-3">
												<div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted font-mono text-sm font-bold text-muted-foreground">
													{feed.title.charAt(0).toUpperCase()}
												</div>
												<div className="min-w-0">
													<h3 className="truncate font-semibold leading-tight">{feed.title}</h3>
													<p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
														<span>{feed.postCount}件の記事</span>
														{(feed.bookmarkCount ?? 0) > 0 && (
															<span className="flex items-center gap-0.5">
																<Users className="size-3" />
																{feed.bookmarkCount}
															</span>
														)}
													</p>
												</div>
											</div>
										</div>
										<Button
											variant="ghost"
											size="icon"
											className="shrink-0 text-muted-foreground/50 opacity-100 transition-all hover:bg-destructive/10 hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100"
											onClick={() => handleDeleteClick(feed.id, feed.title)}
											disabled={deleteFeed.isPending}
										>
											<Trash2 className="size-4" />
										</Button>
									</div>
								</div>
							))}
						</div>
					)}
				</TabsContent>

				{/* ブックマーク済みフィード */}
				<TabsContent value="bookmarked" className="mt-6">
					{bookmarkedLoading ? (
						<div className="flex items-center justify-center py-12">
							<Loader2 className="size-6 animate-spin text-muted-foreground" />
						</div>
					) : bookmarkedFeeds.length === 0 ? (
						<div className="relative overflow-hidden rounded-2xl border border-dashed border-muted-foreground/20 bg-muted/30 p-12 text-center">
							<div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />
							<div className="relative">
								<div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-muted">
									<Bookmark className="size-8 text-muted-foreground" />
								</div>
								<p className="text-lg font-medium text-muted-foreground">
									ブックマークしたフィードはありません
								</p>
								<p className="mt-1 text-sm text-muted-foreground/70">
									フィード一覧でブックマークボタンをクリックして追加しましょう
								</p>
							</div>
						</div>
					) : (
						<div className="grid gap-4">
							{bookmarkedFeeds.map((feed, index) => (
								<div
									key={feed.id}
									className="group relative overflow-hidden rounded-xl border bg-card p-5 transition-all hover:border-primary/20 hover:shadow-md"
									style={{ animationDelay: `${index * 50}ms` }}
								>
									<div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
									<div className="relative flex items-start justify-between gap-4">
										<a
											href={feed.siteUrl}
											target="_blank"
											rel="noopener noreferrer"
											className="min-w-0 flex-1"
										>
											<div className="flex items-center gap-3">
												<div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted font-mono text-sm font-bold text-muted-foreground">
													{feed.title.charAt(0).toUpperCase()}
												</div>
												<div className="min-w-0">
													<h3 className="truncate font-semibold leading-tight group-hover:text-primary">
														{feed.title}
													</h3>
													<p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
														{new URL(feed.siteUrl).hostname}
														<ExternalLink className="size-3" />
													</p>
												</div>
											</div>
										</a>
										<Button
											variant="ghost"
											size="icon"
											className="shrink-0 text-muted-foreground/50 opacity-100 transition-all hover:bg-destructive/10 hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100"
											onClick={() => handleUnbookmarkClick(feed.id, feed.title)}
											disabled={unbookmarkFeed.isPending}
										>
											<Trash2 className="size-4" />
										</Button>
									</div>
								</div>
							))}
						</div>
					)}
				</TabsContent>
			</Tabs>

			{/* 削除確認ダイアログ */}
			<AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>フィードを削除しますか？</AlertDialogTitle>
						<AlertDialogDescription>
							「{deleteTarget?.title}
							」を削除します。関連する記事もすべて削除され、この操作は取り消せません。
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={deleteFeed.isPending}>キャンセル</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleDeleteConfirm}
							disabled={deleteFeed.isPending}
							className="bg-destructive text-white hover:bg-destructive/90"
						>
							{deleteFeed.isPending ? (
								<>
									<Loader2 className="size-4 animate-spin" />
									削除中...
								</>
							) : (
								'削除する'
							)}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{/* ブックマーク解除確認ダイアログ */}
			<AlertDialog
				open={!!unbookmarkTarget}
				onOpenChange={(open) => !open && setUnbookmarkTarget(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>ブックマークを解除しますか？</AlertDialogTitle>
						<AlertDialogDescription>
							「{unbookmarkTarget?.title}」のブックマークを解除します。
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={unbookmarkFeed.isPending}>キャンセル</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleUnbookmarkConfirm}
							disabled={unbookmarkFeed.isPending}
							className="bg-destructive text-white hover:bg-destructive/90"
						>
							{unbookmarkFeed.isPending ? (
								<>
									<Loader2 className="size-4 animate-spin" />
									解除中...
								</>
							) : (
								'解除する'
							)}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	)
}

export function MyFeeds() {
	return (
		<QueryProvider>
			<MyFeedsContent />
		</QueryProvider>
	)
}
