import { Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface SearchInputProps {
	value: string
	onChange: (value: string) => void
	placeholder?: string
	isLoading?: boolean
}

export function SearchInput({
	value,
	onChange,
	placeholder = '記事を検索...',
	isLoading,
}: SearchInputProps) {
	return (
		<div className="relative">
			<Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
			<Input
				type="search"
				value={value}
				onChange={(e) => onChange(e.target.value)}
				placeholder={placeholder}
				className="pl-10 pr-10"
			/>
			{value && !isLoading && (
				<Button
					variant="ghost"
					size="sm"
					className="absolute right-1 top-1/2 size-7 -translate-y-1/2 p-0"
					onClick={() => onChange('')}
				>
					<X className="size-4" />
				</Button>
			)}
			{isLoading && (
				<div className="absolute right-3 top-1/2 -translate-y-1/2">
					<div className="size-4 animate-spin rounded-full border-2 border-muted border-t-primary" />
				</div>
			)}
		</div>
	)
}
