import { cn } from "@/lib/utils";

export function Header({
  demoReady,
  connectivity,
  className,
}: {
  demoReady: boolean;
  connectivity: boolean;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b border-neutral-200/70 bg-white/80 backdrop-blur-xl dark:border-neutral-800/70 dark:bg-neutral-900/70",
        className,
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:h-20 sm:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-cyan-500 shadow-lg shadow-brand-500/20">
            <svg
              className="h-5 w-5 text-white"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
              <path
                d="M12 2v3m0 14v3M2 12h3m14 0h3M4.22 4.22l2.12 2.12m7.78 7.78l2.12 2.12M18.72 4.22L20.84 6.34M6.34 18.72l2.12 2.12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-base font-semibold tracking-tight text-neutral-900 dark:text-white">
              AI Voice Studio
            </h1>
            <p className="hidden text-xs font-medium tracking-wide text-neutral-500 sm:block dark:text-neutral-400">
              Live Conversational AI Demo
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <span
            className={cn(
              "hidden items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition sm:inline-flex",
              demoReady
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400"
                : "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400",
            )}
          >
            <span
              className={cn(
                "relative h-2 w-2 rounded-full",
                demoReady
                  ? "bg-emerald-500 shadow-sm shadow-emerald-500/60"
                  : "bg-amber-500",
              )}
            />
            {demoReady ? "Live Demo Ready" : "Beta"}
          </span>

          <span
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold sm:px-3",
              connectivity
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400"
                : "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-400",
            )}
          >
            <span
              className={cn(
                "relative h-2 w-2 rounded-full",
                connectivity ? "bg-emerald-500" : "bg-red-500",
              )}
            />
            {connectivity ? "Backend Online" : "Offline"}
          </span>
        </div>
      </div>

      <div className="flex h-1 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800/80">
        <div className="h-full rounded-full bg-gradient-to-r from-brand-500 via-cyan-400 to-brand-500" />
      </div>
    </header>
  );
}
