import { ArrowUpRight, AudioLines } from "lucide-react";
import { cn } from "@/lib/utils";
import { VOICE_API_URL } from "@/lib/voice";

const NAV_ITEMS = [
  { label: "Console", href: "#console" },
  { label: "Conversation", href: "#conversation" },
  { label: "Insights", href: "#insights" },
];

function StatusChip({
  tone,
  label,
  dotClassName,
  className,
}: {
  tone: "positive" | "negative" | "neutral";
  label: string;
  dotClassName: string;
  className?: string;
}) {
  const tones = {
    positive: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
    negative: "border-red-400/25 bg-red-400/10 text-red-300",
    neutral: "border-white/10 bg-white/[0.04] text-slate-400",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", dotClassName)} />
      {label}
    </span>
  );
}

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
        "sticky top-0 z-40 border-b border-white/[0.07] bg-ink-950/85 backdrop-blur-xl",
        className,
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <a
          href="#console"
          className="flex shrink-0 items-center gap-2.5 rounded-lg focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950 focus-visible:outline-none"
          aria-label="AI Voice Studio home"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-cyan-500 shadow-lg shadow-brand-700/30">
            <AudioLines className="h-5 w-5 text-white" aria-hidden="true" />
          </span>
          <span className="flex flex-col leading-tight whitespace-nowrap">
            <span className="text-sm font-semibold tracking-tight text-white sm:text-base">
              AI Voice Studio
            </span>
            <span className="hidden text-[11px] font-medium tracking-wide text-slate-400 sm:block">
              Conversational AI voice agent
            </span>
          </span>
        </a>

        <nav
          aria-label="Primary"
          className="hidden items-center gap-1 md:flex"
        >
          {NAV_ITEMS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-lg px-2.5 py-2 text-sm font-medium whitespace-nowrap text-slate-400 transition-colors hover:bg-white/[0.05] hover:text-slate-100 focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none"
            >
              {item.label}
            </a>
          ))}
          <a
            href={`${VOICE_API_URL}/docs`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-sm font-medium whitespace-nowrap text-slate-400 transition-colors hover:bg-white/[0.05] hover:text-slate-100 focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none"
          >
            API Docs
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </nav>

        <div className="flex items-center gap-2">
          <StatusChip
            className="hidden lg:inline-flex"
            tone={demoReady ? "positive" : "neutral"}
            label={demoReady ? "Live Demo Ready" : "Setup Required"}
            dotClassName={demoReady ? "bg-emerald-400" : "bg-slate-500"}
          />
          <StatusChip
            tone={connectivity ? "positive" : "negative"}
            label={connectivity ? "Backend Online" : "Backend Offline"}
            dotClassName={connectivity ? "bg-emerald-400" : "bg-red-400"}
          />
        </div>
      </div>

      {/* Mobile navigation keeps every destination reachable without a menu. */}
      <nav
        aria-label="Mobile"
        className="mx-auto flex w-full max-w-7xl gap-2 overflow-x-auto px-4 pb-3 sm:px-6 md:hidden"
      >
        {NAV_ITEMS.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium whitespace-nowrap text-slate-300 transition-colors hover:bg-white/[0.08] focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none"
          >
            {item.label}
          </a>
        ))}
        <a
          href={`${VOICE_API_URL}/docs`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium whitespace-nowrap text-slate-300 transition-colors hover:bg-white/[0.08] focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none"
        >
          API Docs
        </a>
      </nav>

      <div
        aria-hidden="true"
        className="h-px w-full bg-gradient-to-r from-transparent via-brand-500/40 to-transparent"
      />
    </header>
  );
}
