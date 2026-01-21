import { LogIn, LogOut, Monitor, Moon, Rss, Sun, User } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useCurrentUser, useLogout } from '@/lib/hooks'
import { QueryProvider } from './QueryProvider'
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar'
import { Button } from './ui/button'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuPortal,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from './ui/dropdown-menu'

type Theme = 'light' | 'dark' | 'system'

const THEME_ICONS = {
	light: Sun,
	dark: Moon,
	system: Monitor,
} as const

function useTheme() {
	const [theme, setTheme] = useState<Theme>('system')
	const [mounted, setMounted] = useState(false)

	useEffect(() => {
		setMounted(true)
		const stored = localStorage.getItem('theme') as Theme | null
		if (stored) {
			setTheme(stored)
		}
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

	useEffect(() => {
		const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
		const handleChange = () => {
			if (theme === 'system') {
				const root = document.documentElement
				if (mediaQuery.matches) {
					root.classList.add('dark')
				} else {
					root.classList.remove('dark')
				}
			}
		}

		mediaQuery.addEventListener('change', handleChange)
		return () => mediaQuery.removeEventListener('change', handleChange)
	}, [theme])

	return { theme, setTheme, mounted }
}

function ThemeSubMenu({ theme, setTheme }: { theme: Theme; setTheme: (t: Theme) => void }) {
	const ThemeIcon = THEME_ICONS[theme]
	return (
		<DropdownMenuSub>
			<DropdownMenuSubTrigger>
				<ThemeIcon className="mr-2 size-4" />
				テーマ
			</DropdownMenuSubTrigger>
			<DropdownMenuPortal>
				<DropdownMenuSubContent>
					<DropdownMenuItem onClick={() => setTheme('light')} className="cursor-pointer">
						<Sun className="mr-2 size-4" />
						ライト
						{theme === 'light' && <span className="ml-auto">✓</span>}
					</DropdownMenuItem>
					<DropdownMenuItem onClick={() => setTheme('dark')} className="cursor-pointer">
						<Moon className="mr-2 size-4" />
						ダーク
						{theme === 'dark' && <span className="ml-auto">✓</span>}
					</DropdownMenuItem>
					<DropdownMenuItem onClick={() => setTheme('system')} className="cursor-pointer">
						<Monitor className="mr-2 size-4" />
						システム
						{theme === 'system' && <span className="ml-auto">✓</span>}
					</DropdownMenuItem>
				</DropdownMenuSubContent>
			</DropdownMenuPortal>
		</DropdownMenuSub>
	)
}

function UserMenuContent() {
	const { data: user, isLoading } = useCurrentUser()
	const logout = useLogout()
	const { theme, setTheme, mounted } = useTheme()

	if (isLoading || !mounted) {
		return <div className="size-8 animate-pulse rounded-full bg-muted" />
	}

	if (!user) {
		return (
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="ghost" className="relative size-8 rounded-full">
						<Avatar className="size-8">
							<AvatarFallback>
								<User className="size-4" />
							</AvatarFallback>
						</Avatar>
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-56">
					<DropdownMenuItem asChild className="cursor-pointer">
						<a href="/api/auth/github">
							<LogIn className="mr-2 size-4" />
							GitHubでログイン
						</a>
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					<ThemeSubMenu theme={theme} setTheme={setTheme} />
				</DropdownMenuContent>
			</DropdownMenu>
		)
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" className="relative size-8 rounded-full">
					<Avatar className="size-8">
						<AvatarImage src={user.avatarUrl || undefined} alt={user.name} />
						<AvatarFallback>
							<User className="size-4" />
						</AvatarFallback>
					</Avatar>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-56">
				<DropdownMenuLabel className="font-normal">
					<div className="flex flex-col space-y-1">
						<p className="text-sm font-medium leading-none">{user.name}</p>
						<p className="text-xs leading-none text-muted-foreground">ログイン中</p>
					</div>
				</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuItem asChild className="cursor-pointer">
					<a href="/mypage/feeds">
						<Rss className="mr-2 size-4" />
						マイフィード
					</a>
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<ThemeSubMenu theme={theme} setTheme={setTheme} />
				<DropdownMenuSeparator />
				<DropdownMenuItem
					onClick={() => logout.mutate()}
					disabled={logout.isPending}
					className="cursor-pointer text-destructive focus:text-destructive"
				>
					<LogOut className="mr-2 size-4" />
					ログアウト
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

export function UserMenu() {
	return (
		<QueryProvider>
			<UserMenuContent />
		</QueryProvider>
	)
}
