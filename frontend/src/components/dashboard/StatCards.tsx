import {
  Activity,
  AudioLines,
  Clock3,
  FileText,
  Gauge,
  MessagesSquare,
  Server,
  Sparkles,
} from "lucide-react";
import { CardPlaceholder, DataCard, MetricRow } from "./DataCard";
import type { CallStatus } from "@/components/voice/StatusIndicator";

function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

function formatClock(timestamp: number): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

// Long hostnames break after dots instead of mid-word.
function HostValue({ host }: { host: string }) {
  const parts = host.split(".");
  return (
    <>
      {parts.map((part, index) => (
        <span key={`${part}-${index}`}>
          {part}
          {index < parts.length - 1 && (
            <>
              .<wbr />
            </>
          )}
        </span>
      ))}
    </>
  );
}

function StatusChip({
  tone,
  children,
}: {
  tone: "online" | "offline" | "pending" | "info";
  children: React.ReactNode;
}) {
  const tones = {
    online: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
    offline: "border-red-400/30 bg-red-400/10 text-red-300",
    pending: "border-amber-400/30 bg-amber-400/10 text-amber-300",
    info: "border-brand-400/30 bg-brand-400/10 text-brand-200",
  };
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function BackendConnectionCard({
  online,
  latencyMs,
  host,
  warningCount,
}: {
  online: boolean;
  latencyMs: number | null;
  host: string;
  warningCount: number;
}) {
  return (
    <DataCard
      title="Backend Connection"
      icon={Server}
      action={
        <StatusChip tone={online ? "online" : "offline"}>
          <span
            className={`h-1.5 w-1.5 rounded-full ${online ? "bg-emerald-400" : "bg-red-400"}`}
          />
          {online ? "Online" : "Offline"}
        </StatusChip>
      }
    >
      <dl>
        <MetricRow
          label="Health check"
          value={latencyMs === null ? "Not measured" : `${latencyMs} ms`}
          tone={latencyMs === null ? "muted" : "positive"}
        />
        <MetricRow label="Endpoint" value={<HostValue host={host} />} mono wrap stack />
        <MetricRow
          label="Warnings"
          value={warningCount === 0 ? "None" : String(warningCount)}
          tone={warningCount === 0 ? "positive" : "warning"}
        />
      </dl>
    </DataCard>
  );
}

const AGENT_DETAIL: Record<CallStatus, string> = {
  idle: "Waiting for a session to start.",
  listening: "Capturing your speech until you pause.",
  thinking: "Transcribing and generating a reply.",
  speaking: "Streaming spoken audio back to you.",
  stopped: "Session closed. Start a new call.",
};

export function AgentStatusCard({
  status,
  callActive,
}: {
  status: CallStatus;
  callActive: boolean;
}) {
  return (
    <DataCard
      title="Voice Agent"
      icon={Activity}
      action={
        <StatusChip tone={callActive ? "info" : "pending"}>
          {callActive ? "Session live" : "Standby"}
        </StatusChip>
      }
    >
      <dl>
        <MetricRow label="Phase" value={status} mono />
        <MetricRow label="Mode" value="Assistant" />
      </dl>
      <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
        {AGENT_DETAIL[status]}
      </p>
    </DataCard>
  );
}

export function SelectedVoiceCard({
  voiceId,
  modelId,
  configured,
}: {
  voiceId: string | null;
  modelId: string | null;
  configured: boolean;
}) {
  return (
    <DataCard
      title="Selected Voice"
      icon={AudioLines}
      action={
        <StatusChip tone={configured ? "online" : "pending"}>
          {configured ? "Configured" : "Unknown"}
        </StatusChip>
      }
    >
      {configured ? (
        <>
          <dl>
            <MetricRow label="Voice ID" value={voiceId ?? "—"} mono />
            <MetricRow label="Model ID" value={modelId ?? "—"} mono />
          </dl>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
            Reported by the backend TTS configuration.
          </p>
        </>
      ) : (
        <CardPlaceholder>
          The backend did not report a voice configuration.
        </CardPlaceholder>
      )}
    </DataCard>
  );
}

export function ConversationStatsCard({
  turns,
  messages,
  lastReplyMs,
}: {
  turns: number;
  messages: number;
  lastReplyMs: number | null;
}) {
  return (
    <DataCard title="Conversation" icon={MessagesSquare}>
      <dl>
        <MetricRow label="Completed turns" value={String(turns)} />
        <MetricRow label="Messages" value={String(messages)} />
        <MetricRow
          label="Last reply latency"
          value={lastReplyMs === null ? "Not measured" : `${lastReplyMs} ms`}
          tone={lastReplyMs === null ? "muted" : "default"}
        />
      </dl>
      <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
        Latency is measured locally from request to first reply sentence.
      </p>
    </DataCard>
  );
}

export function SessionInfoCard({
  status,
  startedAt,
  durationMs,
  turns,
  host,
}: {
  status: CallStatus;
  startedAt: number | null;
  durationMs: number;
  turns: number;
  host: string;
}) {
  return (
    <DataCard
      title="Session Information"
      icon={Clock3}
      subtitle="Local session metrics"
    >
      <dl>
        <MetricRow label="Status" value={status} mono />
        <MetricRow
          label="Started"
          value={startedAt === null ? "Not started" : formatClock(startedAt)}
          tone={startedAt === null ? "muted" : "default"}
        />
        <MetricRow
          label="Duration"
          value={startedAt === null ? "—" : formatDuration(durationMs)}
          mono
        />
        <MetricRow label="Turns this session" value={String(turns)} />
        <MetricRow label="API host" value={<HostValue host={host} />} mono wrap />
      </dl>
    </DataCard>
  );
}

export function LiveTextCards({
  transcript,
  reply,
  callActive,
}: {
  transcript: string;
  reply: string;
  callActive: boolean;
}) {
  return (
    <div className="grid h-full gap-4 md:grid-cols-2">
      <DataCard title="Live Transcript" icon={FileText} className="h-full">
        {transcript ? (
          <p className="text-sm leading-relaxed text-slate-200">{transcript}</p>
        ) : (
          <CardPlaceholder>
            {callActive
              ? "Listening… your words will appear here."
              : "No speech captured yet."}
          </CardPlaceholder>
        )}
      </DataCard>

      <DataCard
        title="AI Response"
        icon={Sparkles}
        className="h-full"
        action={
          <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            <Gauge className="h-3 w-3" aria-hidden="true" />
            Streaming
          </span>
        }
      >
        {reply ? (
          <p className="text-sm leading-relaxed text-slate-200">{reply}</p>
        ) : (
          <CardPlaceholder>
            {callActive
              ? "The assistant reply will stream here."
              : "No reply yet in this session."}
          </CardPlaceholder>
        )}
      </DataCard>
    </div>
  );
}
