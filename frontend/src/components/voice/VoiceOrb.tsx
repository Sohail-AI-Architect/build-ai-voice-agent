import { Loader2, Mic, PhoneOff, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export type VoiceState = "idle" | "listening" | "processing" | "speaking" | "stopped";

export function VoiceOrb({
  state,
  hint,
  className,
}: {
  state: VoiceState;
  hint?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex h-24 w-24 items-center justify-center",
        className,
      )}
      role="presentation"
    >
      <div
        className={cn(
          "relative flex h-full w-full items-center justify-center rounded-full",
          state === "speaking"
            ? "bg-gradient-to-br from-brand-500 to-cyan-500 shadow-2xl shadow-brand-500/30"
            : state === "processing"
              ? "bg-gradient-to-br from-amber-500 to-orange-400 shadow-2xl shadow-amber-500/30"
              : state === "listening"
                ? "bg-gradient-to-br from-sky-500 to-cyan-400 shadow-2xl shadow-sky-500/30"
                : state === "stopped"
                  ? "bg-gradient-to-br from-neutral-400 to-neutral-500"
                  : "bg-gradient-to-br from-neutral-200 to-neutral-300",
        )}
      >
        <Sparkles
          className={cn(
            "absolute inset-0 m-auto h-7 w-7 drop-shadow-sm",
            state === "speaking"
              ? "text-white"
              : state === "listening"
                ? "text-white"
                : state === "processing"
                  ? "text-amber-50"
                  : "text-neutral-600",
          )}
          aria-hidden="true"
        />

        {(state === "speaking" || state === "processing") && (
          <span className="absolute inset-0 m-auto flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-white/80" aria-hidden="true" />
          </span>
        )}

        {state === "listening" && (
          <Mic className="absolute inset-0 m-auto h-6 w-6 text-white drop-shadow-sm" aria-hidden="true" />
        )}

        {state === "stopped" && (
          <PhoneOff className="absolute inset-0 m-auto h-6 w-6 text-neutral-500" aria-hidden="true" />
        )}
      </div>

      <div
        className={cn(
          "absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-widest",
          state === "speaking"
            ? "bg-brand-500/15 text-brand-700 dark:text-brand-300"
            : state === "processing"
              ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
              : state === "listening"
                ? "bg-sky-500/15 text-sky-700 dark:text-sky-300"
                : "bg-neutral-200/60 text-neutral-600 dark:bg-neutral-700/30 dark:text-neutral-400",
        )}
      >
        {hint ?? "AI Voice Studio"}
      </div>
    </div>
  );
}
