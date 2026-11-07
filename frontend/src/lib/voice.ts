const BACKEND_URL = (
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "https://backend-three-neon-55.vercel.app"
).replace(/\/+$/, "");

export const VOICE_API_URL = BACKEND_URL;

const DEFAULT_TIMEOUT_MS = 60_000;

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status = 0, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

async function toApiError(res: Response): Promise<ApiError> {
  const code = res.headers.get("X-Error-Code") ?? undefined;
  let message = res.statusText || `Request failed (${res.status})`;
  try {
    const data = (await res.json()) as { detail?: unknown };
    if (typeof data.detail === "string") {
      message = data.detail;
    } else if (Array.isArray(data.detail)) {
      message = data.detail
        .map((d) =>
          typeof d === "object" && d && "msg" in d
            ? String((d as { msg: unknown }).msg)
            : String(d)
        )
        .join("; ");
    }
  } catch {
    // Response was not JSON (e.g. HTML error page); keep the status text.
  }
  return new ApiError(message, res.status, code);
}

async function request(
  path: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const method = init.method ?? "GET";

  console.log(`[voice] -> ${method} ${VOICE_API_URL}${path}`);
  try {
    const res = await fetch(`${VOICE_API_URL}${path}`, {
      ...init,
      signal: controller.signal,
    });
    console.log(`[voice] <- ${res.status} ${method} ${path}`);
    if (!res.ok) {
      const err = await toApiError(res);
      console.error(`[voice] API error on ${path}`, err);
      throw err;
    }
    return res;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new ApiError(
        `Request to ${path} timed out after ${Math.round(
          timeoutMs / 1000
        )}s. The backend may be busy (chat + TTS can take a while).`,
        0,
        "TIMEOUT"
      );
    }
    console.error(`[voice] Network error on ${path}`, e);
    throw new ApiError(
      `Cannot reach the backend at ${VOICE_API_URL}. Is FastAPI running, and is this origin allowed by CORS? (${e instanceof Error ? e.message : "unknown network error"})`,
      0,
      "NETWORK"
    );
  } finally {
    clearTimeout(timer);
  }
}

export function extensionForMime(mime: string): string {
  const base = mime.split(";")[0].trim().toLowerCase();
  if (base.includes("webm")) return "webm";
  if (base.includes("ogg")) return "ogg";
  if (base.includes("mp4") || base.includes("m4a")) return "m4a";
  if (base.includes("mpeg") || base.includes("mp3")) return "mp3";
  if (base.includes("wav")) return "wav";
  if (base.includes("flac")) return "flac";
  return "webm";
}

export async function chat(body: {
  message: string;
  history?: { role: "user" | "agent"; content: string }[];
  language?: "en" | "ur" | "auto";
  mode?: "assistant" | "teacher";
}) {
  const res = await request("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await res.json()) as { reply: string };
}

export async function transcribe(audioBlob: Blob) {
  const fd = new FormData();
  fd.append(
    "audio",
    audioBlob,
    `audio.${extensionForMime(audioBlob.type || "audio/webm")}`
  );
  const res = await request("/api/transcribe", {
    method: "POST",
    body: fd,
  });
  return (await res.json()) as { text: string };
}

export async function voice(body: {
  audio_base64: string;
  audio_mime?: string;
  history?: { role: "user" | "agent"; content: string }[];
  language?: "en" | "ur" | "auto";
  mode?: "assistant" | "teacher";
}) {
  const res = await request("/api/voice", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await res.json()) as { transcript: string; reply: string };
}

export async function tts(text: string, voiceId?: string) {
  const res = await request(
    "/api/tts",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voice_id: voiceId ?? undefined }),
    },
    90_000
  );
  const blob = await res.blob();
  if (!blob.size) {
    throw new ApiError("ElevenLabs returned empty audio", 502, "EMPTY_TTS");
  }
  return blob;
}

export async function listVoices() {
  try {
    const res = await request("/api/voices");
    return (await res.json()) as {
      id: string;
      name: string;
      preview_url: string;
    }[];
  } catch (e) {
    console.error("[voice] Could not load voices", e);
    return [];
  }
}

export async function health() {
  const res = await request("/api/health");
  return (await res.json()) as {
    status: string;
    groq_configured: boolean;
    elevenlabs_configured: boolean;
    warnings?: string[];
  };
}

export async function ttsFallbackInfo() {
  try {
    const res = await request("/api/tts/fallback-info");
    return (await res.json()) as {
      has_key: boolean;
      voice_id: string;
      model_id: string;
    };
  } catch (e) {
    console.error("[voice] Could not read TTS info", e);
    return { has_key: false, voice_id: "", model_id: "" };
  }
}
