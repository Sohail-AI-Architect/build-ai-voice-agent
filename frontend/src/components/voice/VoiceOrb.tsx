import { Loader2, Mic, PhoneOff } from "lucide-react";
import { cn } from "@/lib/utils";

export type VoiceState =
  | "idle"
  | "listening"
  | "processing"
  | "speaking"
  | "stopped";

type OrbTone = {
  core: string;
  glow: string;
  ring: string;
  icon: string;
  label: string;
};

const TONES: Record<VoiceState, OrbTone> = {
  idle: {
    core: "from-[#26305c] via-[#1a2342] to-[#0c1224]",
    glow: "bg-brand-500/30",
    ring: "border-brand-300/20",
    icon: "text-brand-300",
    label: "Ready when you are",
  },
  listening: {
    core: "from-sky-500 via-blue-500 to-cyan-400",
    glow: "bg-cyan-400/35",
    ring: "border-cyan-300/30",
    icon: "text-white",
    label: "Listening",
  },
  processing: {
    core: "from-violet-500 via-brand-500 to-indigo-500",
    glow: "bg-violet-500/35",
    ring: "border-violet-300/30",
    icon: "text-white",
    label: "Processing",
  },
  speaking: {
    core: "from-fuchsia-500 via-violet-500 to-cyan-400",
    glow: "bg-fuchsia-500/35",
    ring: "border-fuchsia-300/30",
    icon: "text-white",
    label: "Speaking",
  },
  stopped: {
    core: "from-slate-700 via-slate-800 to-slate-900",
    glow: "bg-slate-500/10",
    ring: "border-white/10",
    icon: "text-slate-400",
    label: "Call ended",
  },
};

function Waveform({ className }: { className?: string }) {
  const heights = [10, 20, 32, 22, 14, 26, 12];
  return (
    <span
      className={cn("flex items-center gap-1.5", className)}
      aria-hidden="true"
    >
      {heights.map((height, index) => (
        <span
          key={index}
          className="animate-wave w-1.5 origin-center rounded-full bg-white/90"
          style={{
            height: `${height}px`,
            animationDelay: `${index * 0.11}s`,
          }}
        />
      ))}
    </span>
  );
}

export function VoiceOrb({
  state,
  callActive,
  onToggle,
  disabled,
  className,
}: {
  state: VoiceState;
  callActive: boolean;
  onToggle: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const tone = TONES[state];

  return (
    <div className={cn("relative flex items-center justify-center", className)}>
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        aria-pressed={callActive}
        aria-label={callActive ? "End voice call" : "Start voice call"}
        className={cn(
          "group relative flex h-44 w-44 shrink-0 items-center justify-center rounded-full",
          "transition-transform duration-300 ease-out hover:scale-[1.02] active:scale-[0.99]",
          "focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-4 focus-visible:ring-offset-ink-900 focus-visible:outline-none",
          "disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100",
          "sm:h-52 sm:w-52",
        )}
      >
        {/* Ambient glow */}
        <span
          aria-hidden="true"
          className={cn(
            "absolute inset-2 rounded-full blur-2xl transition-colors duration-500",
            tone.glow,
            state === "idle" && "animate-orb-breathe",
            state === "speaking" && "animate-orb-breathe",
          )}
        />

        {/* Listening pulse rings — drawn outside the core so nothing overlaps */}
        {state === "listening" && (
          <>
            <span
              aria-hidden="true"
              className="animate-ring-pulse absolute inset-0 rounded-full border border-cyan-300/50"
            />
            <span
              aria-hidden="true"
              className="animate-ring-pulse absolute inset-0 rounded-full border border-cyan-300/30"
              style={{ animationDelay: "1.4s" }}
            />
          </>
        )}

        {/* Outer ring */}
        <span
          aria-hidden="true"
          className={cn(
            "absolute inset-0 rounded-full border bg-ink-900/40 backdrop-blur-sm transition-colors duration-500",
            tone.ring,
          )}
        />
        <span
          aria-hidden="true"
          className="absolute inset-3 rounded-full border border-white/[0.06]"
        />

        {/* Processing sweep */}
        {state === "processing" && (
          <span
            aria-hidden="true"
            className="animate-spin-slow absolute inset-0 rounded-full border-2 border-transparent border-t-violet-300/80 border-r-violet-300/30"
          />
        )}

        {/* Core */}
        <span
          className={cn(
            "relative flex h-[calc(100%-1.5rem)] w-[calc(100%-1.5rem)] items-center justify-center rounded-full",
            "bg-gradient-to-br shadow-[0_20px_60px_-15px_rgba(0,0,0,0.9)]",
            "ring-1 ring-white/10 transition-colors duration-500",
            tone.core,
          )}
        >
          <span
            aria-hidden="true"
            className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.28),transparent_55%)]"
          />

          <span className={cn("relative", tone.icon)}>
            {state === "speaking" ? (
              <Waveform />
            ) : state === "processing" ? (
              <Loader2 className="h-10 w-10 animate-spin" aria-hidden="true" />
            ) : state === "stopped" ? (
              <PhoneOff className="h-10 w-10" aria-hidden="true" />
            ) : (
              <Mic
                className="h-10 w-10 drop-shadow-sm sm:h-11 sm:w-11"
                aria-hidden="true"
              />
            )}
          </span>
        </span>
      </button>
    </div>
  );
}
