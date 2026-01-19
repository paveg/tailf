import { Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

type Theme = 'light' | 'dark' | 'system'

export function ThemeToggle() {
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

	const toggleTheme = () => {
		setTheme((prev) => {
			if (prev === 'light') return 'dark'
			if (prev === 'dark') return 'system'
			return 'light'
		})
	}

	const isDark =
		theme === 'dark' ||
		(theme === 'system' &&
			typeof window !== 'undefined' &&
			window.matchMedia('(prefers-color-scheme: dark)').matches)

	if (!mounted) {
		return (
			<Button variant="ghost" size="icon" className="size-9">
				<span className="size-4" />
			</Button>
		)
	}

	return (
		<Button
			variant="ghost"
			size="icon"
			className="size-9"
			onClick={toggleTheme}
			title={theme === 'system' ? 'System theme' : theme === 'dark' ? 'Dark mode' : 'Light mode'}
		>
			{isDark ? <Moon className="size-4" /> : <Sun className="size-4" />}
			<span className="sr-only">Toggle theme</span>
		</Button>
	)
}
