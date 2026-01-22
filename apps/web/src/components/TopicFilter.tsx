import { TOPICS, type TopicId } from '@tailf/shared'
import { cn } from '@/lib/utils'
import { Button } from './ui/button'

interface TopicFilterProps {
	value: TopicId | null
	onChange: (topic: TopicId | null) => void
}

export function TopicFilter({ value, onChange }: TopicFilterProps) {
	return (
		<div className="flex flex-wrap gap-1">
			{/* Topic buttons */}
			{TOPICS.map((topic) => (
				<Button
					key={topic.id}
					variant="ghost"
					size="sm"
					onClick={() => onChange(value === topic.id ? null : topic.id)}
					className={cn(
						'h-7 px-2 text-xs text-muted-foreground',
						value === topic.id && 'bg-accent text-accent-foreground font-medium',
					)}
				>
					#{topic.name}
				</Button>
			))}
		</div>
	)
}
