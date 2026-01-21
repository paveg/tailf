/**
 * モバイルナビゲーションコンポーネント
 *
 * シンプルなサイドメニュー
 * shadcn/ui Sheetベース
 */
import { FileText, LogIn, LogOut, Menu, Monitor, Moon, Rss, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useCurrentUser, useLogout } from '@/lib/hooks'
import { QueryProvider } from './QueryProvider'
import { Button } from './ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from './ui/sheet'

type Theme = 'light' | 'dark' | 'system'

const navLinks = [
	{ href: '/posts', label: '記事一覧', icon: FileText },
	{ href: '/feeds', label: 'フィード一覧', icon: Rss },
]

const userNavLinks = [{ href: '/mypage/feeds', label: 'マイフィード', icon: Rss }]

const themeOptions = [
	{ value: 'light' as const, icon: Sun, label: 'ライト' },
	{ value: 'dark' as const, icon: Moon, label: 'ダーク' },
	{ value: 'system' as const, icon: Monitor, label: '自動' },
]

function useTheme() {
	const [theme, setTheme] = useState<Theme>('system')
	const [mounted, setMounted] = useState(false)

	useEffect(() => {
		setMounted(true)
		const stored = localStorage.getItem('theme') as Theme | null
		if (stored) setTheme(stored)
	}, [])

	useEffect(() => {
		if (!mounted) return
		const root = document.documentElement
		const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
		if (theme === 'dark' || (theme === 'system' && systemDark)) {
			root.classList.add('dark')
		} else {
			root.classList.remove('dark')
		}
		localStorage.setItem('theme', theme)
	}, [theme, mounted])

	return { theme, setTheme, mounted }
}

function MobileNavContent() {
	const [open, setOpen] = useState(false)
	const { theme, setTheme, mounted } = useTheme()
	const { data: user } = useCurrentUser()
	const logout = useLogout()

	return (
		<Sheet open={open} onOpenChange={setOpen}>
			<Button
				variant="ghost"
				size="icon"
				className="md:hidden"
				onClick={() => setOpen(true)}
				aria-label="メニューを開く"
			>
				<Menu className="size-5" />
			</Button>

			<SheetContent side="left" className="flex w-72 flex-col p-0">
				<SheetHeader className="border-b px-4 py-4">
					<SheetTitle className="text-left font-mono text-lg">
						<span className="text-muted-foreground">❯ </span>
						<span className="text-primary">tail</span>
						<span className="text-muted-foreground"> -f</span>
					</SheetTitle>
					<SheetDescription className="sr-only">ナビゲーションメニュー</SheetDescription>
				</SheetHeader>

				{/* Navigation */}
				<nav className="flex-1 p-2">
					<div className="space-y-1">
						{navLinks.map((link) => (
							<a
								key={link.href}
								href={link.href}
								onClick={() => setOpen(false)}
								className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-muted"
							>
								<link.icon className="size-4 text-muted-foreground" />
								<span>{link.label}</span>
							</a>
						))}
						{user &&
							userNavLinks.map((link) => (
								<a
									key={link.href}
									href={link.href}
									onClick={() => setOpen(false)}
									className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-muted"
								>
									<link.icon className="size-4 text-muted-foreground" />
									<span>{link.label}</span>
								</a>
							))}
					</div>

					{/* Theme */}
					{mounted && (
						<div className="mt-6 border-t pt-4">
							<p className="mb-2 px-3 text-xs font-medium text-muted-foreground">テーマ</p>
							<div className="flex gap-1 px-2">
								{themeOptions.map((option) => (
									<button
										key={option.value}
										type="button"
										onClick={() => setTheme(option.value)}
										className={`flex flex-1 flex-col items-center gap-1 rounded-lg px-2 py-2 text-xs transition-colors ${
											theme === option.value
												? 'bg-primary text-primary-foreground'
												: 'bg-muted/50 text-muted-foreground hover:bg-muted'
										}`}
									>
										<option.icon className="size-4" />
										<span>{option.label}</span>
									</button>
								))}
							</div>
						</div>
					)}
				</nav>

				{/* User */}
				<div className="border-t p-4">
					{user ? (
						<div className="space-y-3">
							<div className="flex items-center gap-3">
								{user.avatarUrl && (
									<img src={user.avatarUrl} alt={user.name} className="size-10 rounded-full" />
								)}
								<div className="flex-1 overflow-hidden">
									<p className="truncate text-sm font-medium">{user.name}</p>
									<p className="text-xs text-muted-foreground">ログイン中</p>
								</div>
							</div>
							<Button
								variant="outline"
								size="sm"
								className="w-full"
								onClick={() => {
									logout.mutate()
									setOpen(false)
								}}
								disabled={logout.isPending}
							>
								<LogOut className="size-4" />
								ログアウト
							</Button>
						</div>
					) : (
						<Button asChild className="w-full">
							<a href="/api/auth/github">
								<LogIn className="size-4" />
								GitHubでログイン
							</a>
						</Button>
					)}
				</div>
			</SheetContent>
		</Sheet>
	)
}

export function MobileNav() {
	return (
		<QueryProvider>
			<MobileNavContent />
		</QueryProvider>
	)
}
