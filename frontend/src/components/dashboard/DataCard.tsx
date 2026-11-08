import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function DataCard({
  title,
  subtitle,
  icon: Icon,
  action,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  subtitle?: string;
  icon?: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={cn(
        "flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-ink-850/70",
        "shadow-[0_18px_50px_-24px_rgba(0,0,0,0.9)] backdrop-blur-sm",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2.5 border-b border-white/[0.07] px-3.5 py-3">
        <div className="flex min-w-0 items-center gap-2">
          {Icon && (
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-brand-300">
              <Icon className="h-4 w-4" aria-hidden={true} />
            </span>
          )}
          <div className="min-w-0">
            <h2 className="text-[13px] leading-snug font-semibold text-slate-100">
              {title}
            </h2>
            {subtitle && (
              <p className="text-[11px] leading-snug text-slate-400">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {action}
      </div>
      <div className={cn("flex-1 px-4 py-3.5", bodyClassName)}>{children}</div>
    </section>
  );
}

export function MetricRow({
  label,
  value,
  mono,
  wrap,
  stack,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
  wrap?: boolean;
  stack?: boolean;
  tone?: "default" | "positive" | "warning" | "muted";
}) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-300"
      : tone === "warning"
        ? "text-amber-300"
        : tone === "muted"
          ? "text-slate-500"
          : "text-slate-200";

  return (
    <div
      className={cn(
        "py-1",
        stack ? "flex flex-col gap-0.5" : "flex items-baseline justify-between gap-3",
      )}
    >
      <dt className="shrink-0 text-xs text-slate-400">{label}</dt>
      <dd
        className={cn(
          "min-w-0 text-xs font-medium",
          stack ? "text-left" : "text-right",
          !stack && (wrap ? "whitespace-normal" : "truncate"),
          toneClass,
          mono && "font-mono text-[11px]",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

export function CardPlaceholder({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-white/10 bg-white/[0.02] px-3 py-2.5 text-xs leading-relaxed text-slate-500">
      {children}
    </p>
  );
}
