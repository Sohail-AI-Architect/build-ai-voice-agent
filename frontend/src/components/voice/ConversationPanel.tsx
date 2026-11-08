"use client";

import { useEffect, useRef } from "react";
import { MessagesSquare, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export type Speaker = "user" | "agent";

export type ConversationEntry = {
  speaker: Speaker;
  text: string;
  /** Real timestamp recorded when the message was received, if available. */
  at?: number;
};

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
});

function formatTime(timestamp: number): string {
  return timeFormatter.format(new Date(timestamp));
}

export function ConversationPanel({
  entries,
  className,
}: {
  entries: ConversationEntry[];
  className?: string;
}) {
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const lastText = entries.length > 0 ? entries[entries.length - 1].text : "";
  const lastLength = entries.length;

  // Keep the newest message visible without scrolling the whole page.
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [lastLength, lastText]);

  const turns = entries.filter((entry) => entry.speaker === "agent").length;

  return (
    <section
      id="conversation"
      aria-labelledby="conversation-heading"
      className={cn(
        "flex scroll-mt-24 flex-col overflow-hidden rounded-2xl border border-white/10 bg-ink-850/70",
        "shadow-[0_18px_50px_-24px_rgba(0,0,0,0.9)] backdrop-blur-sm",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.07] px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-brand-300">
            <MessagesSquare className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2
              id="conversation-heading"
              className="truncate text-sm font-semibold text-slate-100"
            >
              Conversation
            </h2>
            <p className="truncate text-[11px] text-slate-400">
              Live transcript for this session
            </p>
          </div>
        </div>
        <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          {turns} {turns === 1 ? "reply" : "replies"}
        </span>
      </div>

      <div
        ref={bodyRef}
        role="log"
        aria-live="polite"
        aria-label="Conversation messages"
        className="flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-5"
      >
        {entries.length === 0 ? (
          <div className="flex h-full min-h-40 flex-col items-center justify-center px-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-500">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
            </div>
            <p className="mt-4 text-sm font-medium text-slate-300">
              No conversation yet
            </p>
            <p className="mt-1 max-w-xs text-xs leading-relaxed text-slate-500">
              Start a call and speak — your words and the assistant reply will
              appear here in real time.
            </p>
          </div>
        ) : (
          entries.map((entry, index) => {
            const isUser = entry.speaker === "user";
            return (
              <article
                key={`${entry.speaker}-${index}`}
                className={cn(
                  "animate-fade-up flex items-start gap-3",
                  isUser ? "flex-row-reverse" : "flex-row",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                    isUser
                      ? "bg-white/[0.06] text-slate-300 ring-1 ring-white/10"
                      : "bg-gradient-to-br from-brand-500 to-cyan-500 text-white shadow-sm shadow-brand-700/40",
                  )}
                >
                  {isUser ? "YOU" : <Sparkles className="h-3.5 w-3.5" />}
                </span>

                <div
                  className={cn(
                    "flex min-w-0 max-w-[85%] flex-col gap-1 sm:max-w-[78%]",
                    isUser ? "items-end" : "items-start",
                  )}
                >
                  <div className="flex items-center gap-2 px-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      {isUser ? "You" : "Assistant"}
                    </span>
                    {typeof entry.at === "number" && (
                      <span className="text-[10px] text-slate-600">
                        {formatTime(entry.at)}
                      </span>
                    )}
                  </div>
                  <p
                    className={cn(
                      "rounded-2xl px-4 py-2.5 text-sm leading-relaxed break-words whitespace-pre-wrap",
                      isUser
                        ? "rounded-tr-sm border border-brand-400/25 bg-brand-500/15 text-slate-100"
                        : "rounded-tl-sm border border-white/10 bg-white/[0.045] text-slate-200",
                    )}
                  >
                    {entry.text}
                  </p>
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
