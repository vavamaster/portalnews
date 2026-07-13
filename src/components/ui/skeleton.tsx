import { cn } from "@/lib/utils"
import { Loader2 } from "lucide-react"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("bg-accent animate-pulse rounded-md", className)}
      {...props}
    />
  )
}

/**
 * Reusable loading spinner — consolidates 30+ duplicate
 * `<Loader2 className="h-4 w-4 animate-spin" /> Carregando...` patterns.
 */
function LoadingSpinner({
  label = 'Carregando...',
  className,
  iconClassName,
}: {
  label?: string
  className?: string
  iconClassName?: string
}) {
  return (
    <div className={cn('text-zinc-500 flex items-center gap-2 py-8', className)}>
      <Loader2 className={cn('h-4 w-4 animate-spin', iconClassName)} />
      {label}
    </div>
  )
}

export { Skeleton, LoadingSpinner }

