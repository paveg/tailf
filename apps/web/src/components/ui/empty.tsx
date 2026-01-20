import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EmptyProps {
	icon?: LucideIcon
	title: string
	description?: string
	className?: string
	children?: React.ReactNode
}

export function Empty({ icon: Icon, title, description, className, children }: EmptyProps) {
	return (
		<div className={cn('flex flex-col items-center justify-center py-12 text-center', className)}>
			{Icon && (
				<div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-muted">
					<Icon className="size-8 text-muted-foreground" />
				</div>
			)}
			<p className="text-lg font-medium text-muted-foreground">{title}</p>
			{description && <p className="mt-1 text-sm text-muted-foreground/80">{description}</p>}
			{children && <div className="mt-4">{children}</div>}
		</div>
	)
}
