import { cn } from "@/lib/utils";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        // text-base (16px) on phones: iOS Safari zooms into inputs with a smaller font.
        "h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-base text-zinc-100 placeholder:text-zinc-500 focus:border-violet-500 focus:outline-none disabled:opacity-60 sm:h-10 sm:text-sm",
        props.className,
      )}
    />
  );
}
