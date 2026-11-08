"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Bell, X } from "lucide-react";
import {
  ApiError,
  VOICE_API_URL,
  health,
  ttsFallbackInfo,
} from "@/lib/voice";

import { Header } from "@/components/layout/Header";
import { VoiceOrb } from "@/components/voice/VoiceOrb";
import { ConversationPanel } from "@/components/voice/ConversationPanel";
import { StatusIndicator } from "@/components/voice/StatusIndicator";

/** Runs only in the browser. Kept in a client component so SSR never sees it. */
function isBrowser(): boolean {
  return typeof window !== "undefined";
}
type CallStatus = "idle" | "listening" | "thinking" | "speaking" | "stopped";

// Track which status the voice orb shows (independent of the legacy call status).
type VoiceState = "idle" | "listening" | "processing" | "speaking" | "stopped";

type HistoryEntry = { role: "user" | "agent"; content: string };

// One newline-delimited JSON event from /api/voice/stream.
type StreamEvent = {
  type: "transcript" | "sentence" | "done" | "error";
  text?: string;
  audio?: string;
  reply?: string;
  detail?: string;
  error?: string;
  // Reply language the backend detected from the transcript ("auto" mode).
  language?: "en" | "ur";
};

// Hands-free turn detection.
const SILENCE_AFTER_SPEECH_MS = 1200;
const NO_SPEECH_TIMEOUT_MS = 7000;
const MAX_TURN_MS = 20000;
const MIN_TURN_BYTES = 800;
const MIN_SPEECH_RMS = 0.014;

const MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/ogg",
  "audio/mp4",
  "audio/mpeg",
];

// Silent clip used to unlock the shared <audio> element during the user's
// tap, so replies can auto-play without an autoplay block.
const SILENT_WAV =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

const STATUS_LABEL: Record<CallStatus, string> = {
  idle: "Tap to start",
  listening: "Listening…",
  thinking: "Thinking…",
  speaking: "Speaking…",
  stopped: "Call ended",
};


function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  if (typeof MediaRecorder.isTypeSupported !== "function") return undefined;
  return (
    MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type)) ||
    undefined
  );
}

function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return "Something went wrong";
}

function describeMicError(e: unknown): string {
  if (e instanceof DOMException) {
    if (e.name === "NotAllowedError" || e.name === "SecurityError") {
      return (
        "Microphone permission was denied. Allow mic access in the browser " +
        "site settings and try again."
      );
    }
    if (e.name === "NotFoundError" || e.name === "DevicesNotFoundError") {
      return "No microphone was found. Connect a mic and try again.";
    }
    if (e.name === "NotReadableError") {
      return "The microphone is already in use by another app.";
    }
  }
  return `Could not start the microphone: ${errorMessage(e)}`;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error("Could not read the recording."));
    };
    reader.readAsDataURL(blob);
  });
}

export default function Home() {
  const [callActive, setCallActive] = useState(false);
  const [status, setStatus] = useState<CallStatus>("idle");
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState("");
  const [reply, setReply] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [mode, setMode] = useState("assistant");
  const [ttsReady, setTtsReady] = useState<boolean | null>(null);
  const [backendOnline, setBackendOnline] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const vadTimerRef = useRef<number | null>(null);

  const activeRef = useRef(false);
  const stopTurnRef = useRef<(() => void) | null>(null);

  // Language the backend detected for the current turn, used to give the
  // browser-speech fallback the right pronunciation.
  const replyLanguageRef = useRef<"en" | "ur">("en");

  // Sentence audio waiting to be played, and the resolver for the clip that is
  // currently playing (used to interrupt playback cleanly).
  const queueRef = useRef<string[]>([]);
  const playingRef = useRef(false);
  const stopPlaybackRef = useRef<(() => void) | null>(null);

  const stopVad = useCallback(() => {
    if (vadTimerRef.current !== null) {
      window.clearInterval(vadTimerRef.current);
      window.clearTimeout(vadTimerRef.current);
      vadTimerRef.current = null;
    }
  }, []);

  const stopAudio = useCallback(() => {
    queueRef.current = [];
    stopPlaybackRef.current?.();
    stopPlaybackRef.current = null;

    const audio = audioRef.current;
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      audio.removeAttribute("src");
    }
    if (isBrowser() && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  // Shared audio element, unlocked on the user's tap, so later replies can
  // auto-play without an autoplay block.
  const unlockAudio = useCallback(async () => {
    if (!isBrowser()) return;
    if (!audioRef.current) {
      const audio = new Audio();
      audio.preload = "auto";
      audioRef.current = audio;
    }
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.dataset.unlocked === "1") return;
    try {
      audio.src = SILENT_WAV;
      await audio.play();
      audio.pause();
      audio.dataset.unlocked = "1";
      console.log("[voice] Audio element unlocked for autoplay");
    } catch (e) {
      console.warn("[voice] Could not unlock the audio element", e);
    }
  }, []);

  const ensureStream = useCallback(async () => {
    const existing = streamRef.current;
    if (
      existing &&
      existing.getAudioTracks().some((track) => track.readyState === "live")
    ) {
      return existing;
    }

    if (!isBrowser()) {
      throw new Error("Microphone access is not available in this browser.");
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Microphone access is not available in this browser.");
    }
    if (!window.isSecureContext) {
      throw new Error("Microphone access requires HTTPS or http://localhost.");
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    streamRef.current = stream;

    const AudioCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtor) throw new Error("Web Audio is not supported here.");

    const ctx = audioCtxRef.current ?? new AudioCtor();
    audioCtxRef.current = ctx;
    if (ctx.state === "suspended") await ctx.resume();

    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.6;
    source.connect(analyser);
    analyserRef.current = analyser;

    return stream;
  }, []);

  const releaseMedia = useCallback(() => {
    stopVad();
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    analyserRef.current = null;
    const ctx = audioCtxRef.current;
    audioCtxRef.current = null;
    if (ctx && ctx.state !== "closed") void ctx.close();
  }, [stopVad]);

  /** Record one spoken turn. Resolves with the audio Blob, or null when the
   * turn was silent, too short, or the call was ended while recording.
   */
  const recordTurn = useCallback(async (): Promise<Blob | null> => {
    const stream = streamRef.current;
    if (!stream) return null;

    if (!isBrowser()) return null;

    let recorder: MediaRecorder;
    const mimeType = pickMimeType();
    try {
      recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
    } catch (e) {
      console.warn(`[voice] MediaRecorder rejected "${mimeType}"`, e);
      try {
        recorder = new MediaRecorder(stream);
      } catch (err) {
        console.error("[voice] MediaRecorder could not start", err);
        throw new Error("This browser cannot record audio.");
      }
    }

    return new Promise<Blob | null>((resolve) => {
      const chunks: Blob[] = [];
      let settled = false;

      const finish = (blob: Blob | null) => {
        if (settled) return;
        settled = true;
        stopVad();
        stopTurnRef.current = null;
        recorderRef.current = null;
        resolve(blob);
      };

      const stopTurn = () => {
        if (recorder.state === "recording") recorder.stop();
      };
      stopTurnRef.current = stopTurn;

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) chunks.push(event.data);
      };

      recorder.onerror = (event) => {
        console.error("[voice] MediaRecorder error", event);
        setError(
          "The recorder stopped unexpectedly. Tap the call button to restart."
        );
        finish(null);
      };

      recorder.onstop = () => {
        const type = recorder.mimeType || chunks[0]?.type || "audio/webm";
        const blob = new Blob(chunks, { type });
        console.log(`[voice] Turn finished: ${blob.size} bytes (${type})`);

        if (!activeRef.current) {
          finish(null);
          return;
        }
        if (blob.size < MIN_TURN_BYTES) {
          console.log("[voice] Too-short turn, ignoring");
          finish(null);
          return;
        }
        finish(blob);
      };

      recorderRef.current = recorder;
      recorder.start(200);
      setStatus("listening");
      setVoiceState("listening");
      console.log(
        `[voice] Listening (mimeType "${recorder.mimeType || "browser default"}")`
      );

      // ---- voice activity detection ----
      stopVad();
      const analyser = analyserRef.current;
      if (!analyser || !isBrowser()) {
        vadTimerRef.current = window.setTimeout(stopTurn, MAX_TURN_MS);
        return;
      }

      const data = new Uint8Array(analyser.fftSize);
      let speechSeen = false;
      let lastVoiceAt = performance.now();
      let baselineSum = 0;
      let baselineSamples = 0;
      const startedAt = performance.now();

      vadTimerRef.current = window.setInterval(() => {
        if (recorder.state !== "recording") {
          stopVad();
          return;
        }

        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i += 1) {
          const value = (data[i] - 128) / 128;
          sum += value * value;
        }
        const rms = Math.sqrt(sum / data.length);
        const now = performance.now();

        if (baselineSamples < 8) {
          baselineSum += rms;
          baselineSamples += 1;
          return;
        }

        const noiseFloor = baselineSum / baselineSamples;
        const threshold = Math.max(MIN_SPEECH_RMS, noiseFloor * 2.2);

        if (rms > threshold) {
          speechSeen = true;
          lastVoiceAt = now;
        }

        if (speechSeen && now - lastVoiceAt > SILENCE_AFTER_SPEECH_MS) {
          console.log("[voice] Silence detected, ending turn");
          stopTurn();
        } else if (!speechSeen && now - startedAt > NO_SPEECH_TIMEOUT_MS) {
          console.log("[voice] No speech detected, listening again");
          stopTurn();
        } else if (now - startedAt > MAX_TURN_MS) {
          console.log("[voice] Max turn length reached");
          stopTurn();
        }
      }, 100);
    });
  }, [stopVad]);

  const browserSpeakAndWait = useCallback((text: string): Promise<void> => {
    if (!isBrowser() || !("speechSynthesis" in window)) {
      setError(
        "ElevenLabs TTS failed and this browser has no speech synthesis fallback."
      );
      return Promise.resolve();
    }
    window.speechSynthesis.cancel();
    return new Promise<void>((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        resolve();
      };
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = replyLanguageRef.current === "ur" ? "ur-PK" : "en-US";
      utterance.rate = 1.05;
      utterance.onend = finish;
      utterance.onerror = (event) => {
        console.error("[voice] Browser speechSynthesis error", event);
        finish();
      };
      window.speechSynthesis.speak(utterance);
    });
  }, []);

  /** Play queued sentence audio one clip after another. */
  const drainPlayback = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || playingRef.current || !isBrowser()) return;

    playingRef.current = true;
    if (activeRef.current) setVoiceState("speaking");
    try {
      while (queueRef.current.length > 0) {
        const src = queueRef.current.shift();
        if (!src) break;
        await new Promise<void>((resolve) => {
          let settled = false;
          const finish = () => {
            if (settled) return;
            settled = true;
            audio.onended = null;
            audio.onerror = null;
            stopPlaybackRef.current = null;
            resolve();
          };
          stopPlaybackRef.current = finish;
          audio.onended = finish;
          audio.onerror = (event) => {
            console.error("[voice] Audio playback error", event);
            finish();
          };
          audio.src = src;
          audio.play().catch((e) => {
            console.error("[voice] Could not play the reply", e);
            finish();
          });
        });
      }
    } finally {
      playingRef.current = false;
      stopPlaybackRef.current = null;
    }
  }, []);

  const enqueueSentenceAudio = useCallback(
    (base64: string) => {
      queueRef.current.push(`data:audio/mpeg;base64,${base64}`);
      void drainPlayback();
    },
    [drainPlayback]
  );

  const waitForPlayback = useCallback(async () => {
    if (!isBrowser()) return;
    while (playingRef.current || queueRef.current.length > 0) {
      await new Promise((resolve) => window.setTimeout(resolve, 100));
    }
  }, []);

  /**
   * Send one recorded turn to /api/voice/stream and play the reply as its
   * sentences arrive. Resolves once playback has finished.
   */
  const runVoiceTurn = useCallback(
    async (
      blob: Blob,
      conversation: HistoryEntry[]
    ): Promise<{ transcript: string; reply: string }> => {
      const audioBase64 = await blobToBase64(blob);

      const res = await fetch(`${VOICE_API_URL}/api/voice/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audio_base64: audioBase64,
          audio_mime: blob.type || undefined,
          history: conversation,
          // Auto-detect: the backend reads the transcript, picks the English or
          // Urdu prompt and the matching ElevenLabs model, and reports the
          // result in the "transcript" event.
          language: "auto",
          mode,
        }),
      });

      if (!res.ok) {
        let message = res.statusText || `Request failed (${res.status})`;
        try {
          const data = (await res.json()) as { detail?: unknown };
          if (typeof data.detail === "string") message = data.detail;
        } catch {
          // Not JSON (e.g. an HTML error page); keep the status text.
        }
        throw new ApiError(message, res.status);
      }
      if (!res.body) {
        throw new Error("Streaming is not supported in this browser.");
      }

      let turnTranscript = "";
      let turnReply = "";
      let fallbackText = "";

      const handleLine = (line: string) => {
        const event = JSON.parse(line) as StreamEvent;
        switch (event.type) {
          case "transcript": {
            turnTranscript = event.text ?? "";
            setTranscript(turnTranscript);
            if (event.language === "en" || event.language === "ur") {
              replyLanguageRef.current = event.language;
            }
            break;
          }
          case "sentence": {
            if (event.text) {
              turnReply =
                turnReply ? `${turnReply} ${event.text}` : event.text;
              setReply(turnReply);
            }
            if (event.audio) {
              enqueueSentenceAudio(event.audio);
            } else if (event.error) {
              console.warn("[voice] Sentence TTS failed", event.error);
              fallbackText = `${fallbackText} ${event.text ?? ""}`.trim();
            }
            break;
          }
          case "done": {
            turnReply = event.reply ?? turnReply;
            setReply(turnReply);
            break;
          }
          case "error": {
            throw new Error(
              event.detail ?? event.error ?? "The assistant could not reply."
            );
          }
        }
      };

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let newline = buffer.indexOf("\n");
        while (newline >= 0) {
          const line = buffer.slice(0, newline).trim();
          buffer = buffer.slice(newline + 1);
          if (line) handleLine(line);
          newline = buffer.indexOf("\n");
        }
      }
      const rest = buffer.trim();
      if (rest) handleLine(rest);

      await waitForPlayback();
      if (fallbackText) await browserSpeakAndWait(fallbackText);

      return { transcript: turnTranscript, reply: turnReply };
    },
    [browserSpeakAndWait, enqueueSentenceAudio, mode, waitForPlayback]
  );

  // ---- the whole call: listen -> reply -> speak -> listen again ----
  const startCall = useCallback(async () => {
    if (activeRef.current) return;

    setError(null);
    setWarning(null);
    setStatus("listening");
    setVoiceState("listening");

    activeRef.current = true;
    setCallActive(true);
    setTranscript("");
    setReply("");
    setHistory([]);

    // Unlock here, inside the tap, so every later reply can auto-play.
    await unlockAudio();

    try {
      await ensureStream();
    } catch (e) {
      console.error("[voice] Could not open the microphone", e);
      activeRef.current = false;
      setCallActive(false);
      setStatus("idle");
      setVoiceState("stopped");
      setError(describeMicError(e));
      return;
    }

    const conversation: HistoryEntry[] = [];
    try {
      while (activeRef.current) {
        let blob: Blob | null = null;
        try {
          blob = await recordTurn();
        } catch (e) {
          console.error("[voice] Recording failed", e);
          setError(errorMessage(e));
          break;
        }

        if (!activeRef.current) break;
        if (!blob) continue; // silence / tap-to-cancel: keep listening

        setStatus("thinking");
        setVoiceState("processing");
        setError(null);

        try {
          const turn = await runVoiceTurn(blob, conversation);
          if (turn.transcript) {
            conversation.push({ role: "user", content: turn.transcript });
          }
          if (turn.reply) {
            conversation.push({ role: "agent", content: turn.reply });
          }
          setHistory([...conversation]);
        } catch (e) {
          console.error("[voice] Voice turn failed", e);
          setError(errorMessage(e));
        }

        if (!activeRef.current) break;
        setStatus("listening");
        setVoiceState("listening");
      }
    } finally {
      console.log("[voice] Call loop ended");
      activeRef.current = false;
      releaseMedia();
      stopAudio();
      setStatus("idle");
      setVoiceState("stopped");
      setCallActive(false);
    }
  }, [
    ensureStream,
    recordTurn,
    releaseMedia,
    runVoiceTurn,
    stopAudio,
    unlockAudio,
  ]);

  const endCall = useCallback(() => {
    if (!activeRef.current) return;
    activeRef.current = false;
    stopTurnRef.current?.();
    stopAudio();
    setStatus("stopped");
    setVoiceState("stopped");
    setCallActive(false);
  }, [stopAudio]);

  // Report TTS availability and any backend configuration warnings once.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [report, info] = await Promise.all([health(), ttsFallbackInfo()]);
        if (cancelled) return;
        setBackendOnline(true);
        setTtsReady(Boolean(report.elevenlabs_configured && info.has_key));
        const warnings = report.warnings ?? [];
        if (warnings.length > 0) setWarning(warnings[0]);
      } catch (e) {
        console.error("[voice] Health check failed", e);
        setBackendOnline(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Release the microphone and audio element when leaving the page.
  useEffect(() => {
    return () => {
      activeRef.current = false;
      stopTurnRef.current?.();
      stopAudio();
      releaseMedia();
    };
  }, [releaseMedia, stopAudio]);

  // Real, ordered conversation for the panel: all completed turns plus the
  // turn that is currently being processed.
  const inFlight = status === "thinking" || status === "speaking";
  const conversationEntries: { speaker: "user" | "agent"; text: string }[] = [
    ...history.map((entry) => ({ speaker: entry.role, text: entry.content })),
    ...(inFlight && transcript
      ? [{ speaker: "user" as const, text: transcript }]
      : []),
    ...(inFlight && reply ? [{ speaker: "agent" as const, text: reply }] : []),
  ];

  return (
    <div className="flex min-h-full flex-col bg-neutral-50 dark:bg-neutral-950">
      <Header
        demoReady={ttsReady === true}
        connectivity={backendOnline}
      />

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 py-8 sm:gap-6 sm:px-6 sm:py-10">
        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <p className="flex-1">{error}</p>
            <button
              type="button"
              onClick={() => setError(null)}
              aria-label="Dismiss error"
              className="rounded p-0.5 hover:bg-red-500/10"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        )}

        {warning && (
          <div
            role="status"
            className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
          >
            <Bell className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <p className="flex-1">{warning}</p>
            <button
              type="button"
              onClick={() => setWarning(null)}
              aria-label="Dismiss warning"
              className="rounded p-0.5 hover:bg-amber-500/10"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        )}

        <section className="flex flex-col items-center gap-4 rounded-2xl border border-neutral-200 bg-white/70 px-4 py-6 dark:border-neutral-800 dark:bg-neutral-900/60">
          <VoiceOrb
            state={voiceState}
            hint={callActive ? STATUS_LABEL[status] : "Tap to start"}
          />
          <StatusIndicator
            status={status}
            voiceState={voiceState}
            callActive={callActive}
            onStart={() => void startCall()}
            onEnd={endCall}
          />
        </section>

        <ConversationPanel
          entries={conversationEntries}
          className="max-h-80 min-h-40 rounded-2xl border border-neutral-200 bg-white/70 dark:border-neutral-800 dark:bg-neutral-900/60"
        />

        <div className="flex flex-wrap items-center gap-2">
          {["assistant"].map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setMode(option)}
              disabled={callActive}
              aria-pressed={mode === option}
              className={`rounded-full border px-3 py-1.5 text-sm capitalize transition disabled:opacity-50 ${
                mode === option
                  ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900"
                  : "border-neutral-300 text-neutral-600 hover:border-neutral-400 dark:border-neutral-700 dark:text-neutral-300"
              }`}
            >
              {option}
            </button>
          ))}
        </div>

      </main>
    </div>
  );
}
