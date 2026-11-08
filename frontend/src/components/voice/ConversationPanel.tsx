import { cn } from "@/lib/utils";

export type Speaker = "user" | "agent";

export function ConversationPanel({
  entries,
  className,
}: {
  entries: { speaker: Speaker; text: string }[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 overflow-y-auto px-4 py-3 sm:px-5",
        className,
      )}
      role="log"
      aria-label="Conversation"
      aria-live="polite"
    >
      {entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500">
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <path
                d="M8 10h8M8 14h5"
                strokeLinecap="round"
              />
              <circle cx="12" cy="10" r="3" stroke="#e8a0d0" strokeWidth="1.5" />
              <circle cx="18" cy="14" r="2" stroke="#a0d0e8" strokeWidth="1.5" />
            </svg>
          </div>
          <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
            Your conversation will appear here
          </p>
          <p className="text-xs text-neutral-400 dark:text-neutral-500">
            Tap the mic and say hello to get started
          </p>
        </div>
      ) : (
        entries.map((entry, index) => (
          <div
            key={index}
            className={cn(
              "flex gap-3 sm:gap-4",
              entry.speaker === "user"
                ? "justify-end"
                : "justify-start",
            )}
          >
            <div
              className={cn(
                "max-w-[80%] sm:max-w-[70%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm",
                entry.speaker === "user"
                  ? "bg-gradient-to-br from-neutral-900 to-neutral-800 text-white rounded-br-sm"
                  : "bg-white/80 text-neutral-800 border border-neutral-200 rounded-bl-sm dark:bg-neutral-800/70 dark:text-neutral-100 dark:border-neutral-700",
              )}
            >
              {entry.text}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
