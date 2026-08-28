import { cn } from "@/lib/utils";

export function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-violet-400/40 bg-violet-500/10 px-2.5 py-1 text-xs text-violet-200",
        className,
      )}
      {...props}
    />
  );
}
