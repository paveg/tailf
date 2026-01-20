'use client'

import { Toaster as Sonner } from 'sonner'

type ToasterProps = React.ComponentProps<typeof Sonner>

function Toaster({ ...props }: ToasterProps) {
	return (
		<Sonner
			className="toaster group"
			toastOptions={{
				classNames: {
					toast:
						'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
					description: 'group-[.toast]:text-muted-foreground',
					actionButton: 'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
					cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
					success: '!bg-success !text-success-foreground !border-success',
					error: '!bg-destructive !text-destructive-foreground !border-destructive',
					warning: '!bg-warning !text-warning-foreground !border-warning',
					info: '!bg-info !text-info-foreground !border-info',
				},
			}}
			{...props}
		/>
	)
}

export { Toaster }
