import { Loader2, Mic, PhoneOff, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export type CallStatus = "idle" | "listening" | "thinking" | "speaking" | "stopped";
export type VoiceState = "idle" | "listening" | "processing" | "speaking" | "stopped";

export function StatusIndicator({
  status,
  voiceState,
  callActive,
  onStart,
  onEnd,
  disabled,
}: {
  status: CallStatus;
  voiceState: VoiceState;
  callActive: boolean;
  onStart: () => void;
  onEnd: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-4">
      <button
        type="button"
        onClick={callActive ? onEnd : onStart}
        disabled={disabled}
        aria-label={callActive ? "End call" : "Start call"}
        className={cn(
          "group relative flex h-24 w-24 items-center justify-center rounded-full transition-all duration-300 focus-visible:outline-2 focus-visible:outline-offset-2",
          callActive
            ? "bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/30 hover:shadow-red-500/40"
            : voiceState === "speaking"
              ? "bg-gradient-to-br from-brand-500 to-cyan-500 text-white hover:scale-105 shadow-lg shadow-brand-500/30"
              : voiceState === "listening"
                ? "bg-gradient-to-br from-sky-500 to-cyan-400 text-white hover:scale-105 shadow-lg shadow-sky-500/30"
                : "bg-gradient-to-br from-neutral-200 to-neutral-300 text-neutral-600 hover:scale-105 hover:from-neutral-300 hover:to-neutral-400 shadow-md shadow-neutral-200 dark:shadow-black/30",
          disabled && "pointer-events-none opacity-50",
        )}
      >
        <span className="relative">
          {status === "thinking" ? (
            <Loader2 className="h-8 w-8 animate-spin" aria-hidden="true" />
          ) : callActive ? (
            <PhoneOff className="h-8 w-8" aria-hidden="true" />
          ) : (
            <Mic className="h-8 w-8" aria-hidden="true" />
          )}
          <span
            className={cn(
              "absolute inset-0 rounded-full pointer-events-none",
              callActive
                ? "bg-red-500/20"
                : voiceState === "speaking"
                  ? "bg-brand-500/20"
                  : voiceState === "listening"
                    ? "bg-sky-500/20"
                    : "bg-neutral-300/40 dark:bg-neutral-600/40",
            )}
          />
        </span>
      </button>

      <div className="flex items-center gap-2">
        <span
          className={cn(
            "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
            status === "listening"
              ? "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300"
              : status === "thinking"
                ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                : status === "speaking"
                  ? "bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
                  : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
          )}
        >
          {callActive ? (
            <>
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  status === "speaking"
                    ? "bg-brand-500"
                    : status === "listening"
                      ? "bg-sky-500"
                      : "bg-neutral-400",
                )}
              />
              {status === "listening"
                ? "Listening…"
                : status === "thinking"
                  ? "Thinking…"
                  : status === "speaking"
                    ? "Speaking…"
                    : "Available"}
            </>
          ) : (
            <>
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              AI Voice Studio
            </>
          )}
        </span>
        {callActive && (
          <span
            className="text-xs text-neutral-400 dark:text-neutral-500"
            role="status"
            aria-live="polite"
          >
            {voiceState === "listening" && "Recording…"}
            {voiceState === "processing" && "Working on your reply…"}
            {voiceState === "speaking" && "Playing response…"}
            {voiceState === "stopped" && "Connection ended"}
          </span>
        )}
      </div>
    </div>
  );
}
