import { Loader2, Mic, PhoneOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { VoiceState } from "./VoiceOrb";

export type CallStatus =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking"
  | "stopped";

const STATUS_META: Record<
  CallStatus,
  { label: string; dot: string; pill: string }
> = {
  idle: {
    label: "Ready",
    dot: "bg-slate-400",
    pill: "border-white/10 bg-white/[0.04] text-slate-300",
  },
  listening: {
    label: "Listening",
    dot: "bg-cyan-400",
    pill: "border-cyan-400/30 bg-cyan-400/10 text-cyan-200",
  },
  thinking: {
    label: "Thinking",
    dot: "bg-violet-400",
    pill: "border-violet-400/30 bg-violet-400/10 text-violet-200",
  },
  speaking: {
    label: "Speaking",
    dot: "bg-fuchsia-400",
    pill: "border-fuchsia-400/30 bg-fuchsia-400/10 text-fuchsia-200",
  },
  stopped: {
    label: "Call ended",
    dot: "bg-slate-500",
    pill: "border-white/10 bg-white/[0.03] text-slate-400",
  },
};

const STATE_DETAIL: Record<VoiceState, string> = {
  idle: "Microphone is off",
  listening: "Recording your voice",
  processing: "Generating a reply",
  speaking: "Playing the reply",
  stopped: "Microphone released",
};

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
  const meta = STATUS_META[status];

  return (
    <div className="flex w-full flex-col items-center gap-5">
      <div
        className={cn(
          "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold tracking-wide",
          meta.pill,
        )}
      >
        <span className="relative flex h-2 w-2">
          {callActive && (
            <span
              className={cn(
                "absolute inline-flex h-full w-full animate-ping rounded-full opacity-60",
                meta.dot,
              )}
            />
          )}
          <span
            className={cn("relative inline-flex h-2 w-2 rounded-full", meta.dot)}
          />
        </span>
        {meta.label}
        <span className="font-normal opacity-40" aria-hidden="true">
          ·
        </span>
        <span className="font-normal opacity-70">{STATE_DETAIL[voiceState]}</span>
      </div>

      <div className="flex w-full flex-col items-center gap-3 sm:flex-row sm:justify-center">
        {callActive ? (
          <button
            type="button"
            onClick={onEnd}
            disabled={disabled}
            className={cn(
              "inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-400/30 bg-red-500/15 px-6 py-3 text-sm font-semibold text-red-200",
              "transition-colors hover:border-red-400/50 hover:bg-red-500/25",
              "focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900 focus-visible:outline-none",
              "disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto",
            )}
          >
            {status === "thinking" ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <PhoneOff className="h-4 w-4" aria-hidden="true" />
            )}
            End Call
          </button>
        ) : (
          <button
            type="button"
            onClick={onStart}
            disabled={disabled}
            className={cn(
              "inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-cyan-500 px-6 py-3 text-sm font-semibold text-white",
              "shadow-lg shadow-brand-700/30 transition-all hover:brightness-110 active:scale-[0.99]",
              "focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900 focus-visible:outline-none",
              "disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto",
            )}
          >
            <Mic className="h-4 w-4" aria-hidden="true" />
            Start Call
          </button>
        )}
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {meta.label}. {STATE_DETAIL[voiceState]}.
      </p>
    </div>
  );
}
