# AI Voice Agent

A premium, full-stack AI voice assistant built with **Next.js 16**, **FastAPI**, **Groq**, and **ElevenLabs**. Features real-time voice interaction, streaming LLM replies, and spoken audio — all in the browser.

[Live Demo](https://frontend-two-flame-37.vercel.app) · [Backend API](https://backend-three-neon-55.vercel.app) · [GitHub Repository](https://github.com/Sohail-AI-Architect/build-ai-voice-agent)

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Key Features](#2-key-features)
3. [Technology Stack](#3-technology-stack)
4. [Architecture](#4-architecture)
5. [Project Structure](#5-project-structure)
6. [Live Frontend Demo](#6-live-frontend-demo)
7. [Backend API](#7-backend-api)
8. [Installation](#8-installation)
9. [Frontend Setup](#9-frontend-setup)
10. [Backend Setup](#10-backend-setup)
11. [Environment Variables](#11-environment-variables)
12. [Frontend-to-Backend Connection](#12-frontend-to-backend-connection)
13. [CORS Configuration](#13-cors-configuration)
14. [Voice Streaming API Endpoint](#14-voice-streaming-api-endpoint)
15. [NDJSON Response Format](#15-ndjson-response-format)
16. [Groq and ElevenLabs Integration](#17-groq-and-elevenlabs-integration)
17. [Deployment Instructions](#18-deployment-instructions-and-troubleshooting)
18. [Troubleshooting](#19-troubleshooting)
19. [Security Notes](#20-security-notes)
20. [License](#21-license)
21. [Contribution Guidelines](#22-contribution-guidelines)
22. [Contact](#23-contact)

---

## 1. Project Overview

**AI Voice Agent** is a two-service application:

- **Frontend** — a Next.js App Router application that lets a visitor start a live voice call in the browser, speak naturally, and hear the agent reply with spoken audio. It renders a status orb, call control with turn status, and a streaming conversation transcript.

- **Backend** — a FastAPI service that performs the actual voice work: audio capture/streaming, speech recognition, language detection, a Groq LLM reply, and speech synthesis.

The frontend and backend are separate Vercel projects with their own production URLs. The frontend connects to the backend via `POST /api/voice/stream` using NDJSON streaming.

---

## 2. Key Features

| Feature | Description |
|---|---|
| **Live voice call** | Visitor taps a mic button, speaks, and the agent listens, replies, and responds with spoken audio (browser speech synthesis fallback). |
| **Real-time streaming** | The voice reply streams back as newline-delimited JSON (NDJSON); the transcript, reply sentences, and audio segments arrive incrementally. |
| **Voice engine preservation** | Microphone permissions, MediaRecorder, voice activity detection (VAD) / silence detection, max turn length, audio conversion and base64 upload, conversation history, and a SpeechSynthesis fallback. |
| **Premium UI** | Dark navy/charcoal theme with blue/violet/cyan accents, soft gradients, rounded cards, subtle borders and shadows, hover/transition micro-interactions, high-quality typography, and responsive layout at 1440×1100, 834×1200, and 390×1400. |
| **Status signals** | Live Demo and Backend Online / Offline indicator in header; mic turn-status chip (recording, working on reply, playing response) under the call button. |
| **Language awareness** | Backend detects the reply language (English or Urdu) and the browser fallback speaks it in the matching pronunciation. |

---

## 3. Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS v4, Geist / Geist Mono fonts, `lucide-react` icons, Radix UI primitives, Framer Motion, `clsx` + `tailwind-merge`, `sonner` |
| **Backend** | FastAPI, Uvicorn, Python 3, `python-multipart`, `httpx`, `psutil`, Groq agents SDK, `pydantic` |
| **Voice Pipeline** | Browser `MediaRecorder` + `<audio>` playback, Web Audio API VAD, Groq LLM, ElevenLabs-style voice pipeline, browser `speechSynthesis` fallback |
| **Deployment** | Vercel (frontend and backend projects) |

---

## 4. Architecture

The application consists of two separate services:

### Frontend (Next.js 16)

- Single App Router route at `frontend/src/app/page.tsx`
- Voice engine lives in `frontend/src/app/page.tsx` and `frontend/src/lib/voice.ts`
- Components:
  - `Header.tsx` — product identity, Live Demo badge, Backend Online/Offline badge
  - `VoiceOrb.tsx` — 96px state orb (idle, listening, processing, speaking, stopped)
  - `StatusIndicator.tsx` — start/end call button + mic turn-status chip
  - `ConversationPanel.tsx` — ordered conversation transcript
- Voice pipeline: `MediaRecorder` → Web Audio API VAD → `POST /api/voice/stream` → NDJSON reader → playback queue → `speechSynthesis` fallback

### Backend (FastAPI)

- Rooted at `backend/main.py`
- Only router registered: `voice_router` (mounts under `/api`)
- Core pipeline under `backend/services/`:
  - `stt.py` — speech-to-text transcription
  - `language_detect.py` — reply-language detection
  - `llm.py` — Groq chat completion and sentence streaming
  - `tts.py` — text-to-speech routing (ElevenLabs when configured, with browser fallback)
- Endpoints: `GET /health`, `POST /transcribe`, `POST /chat`, `POST /tts`, `POST /voice`, `POST /voice/stream`, `GET /voices`, `GET /tts/fallback-info`

---

## 5. Project Structure

```
.
├── backend/
│   ├── main.py                 # FastAPI app + CORS + route registration
│   ├── config.py               # environment loading and validation
│   ├── requirements.txt        # Python dependencies
│   ├── vercel.json             # backend Vercel project config
│   ├── .env.example            # environment variable template (no secrets)
│   ├── my_agents/              # voice/teacher agent logic
│   ├── routes/
│   │   └── voice.py            # /api/voice/stream endpoint
│   └── services/
│       ├── llm.py, stt.py, tts.py, language_detect.py
│       └── __init__.py
├── frontend/
│   ├── src/app/page.tsx        # UI host + voice engine
│   ├── src/app/layout.tsx      # root layout + metadata
│   ├── src/app/globals.css     # premium Tailwind theme tokens
│   ├── src/lib/voice.ts        # named API client for the backend
│   ├── src/lib/utils.ts        # cn() helper
│   ├── src/components/         # premium UI components
│   ├── next.config.ts
│   ├── tsconfig.json
│   ├── package.json
│   └── README.md               # concise frontend README
├── main.py                     # project root entry (exports the app)
├── .gitignore
└── README.md                   # this file (project root)
```

---

## 6. Live Frontend Demo

The live frontend demo is hosted on Vercel:

- **<https://frontend-two-flame-37.vercel.app>**

It connects to the backend API at `https://backend-three-neon-55.vercel.app`.

---

## 7. Backend API

The backend API is hosted on Vercel:

- **<https://backend-three-neon-55.vercel.app>**

It exposes the following endpoints:

| Endpoint | Method | Description |
|---|---|---|
| `/` | `GET` | Root endpoint with API info |
| `/health` | `GET` | Health check with configuration diagnostics |
| `/transcribe` | `POST` | Transcribe audio to text using Groq Whisper |
| `/chat` | `POST` | Chat with the agent. Supports conversation history and language selection. |
| `/tts` | `POST` | Text-to-speech streaming from ElevenLabs. |
| `/voice` | `POST` | Voice interaction: transcribe audio then respond. |
| `/voice/stream` | `POST` | Voice turn streamed as newline-delimited JSON. |
| `/voices` | `GET` | List available ElevenLabs voices. |
| `/tts/fallback-info` | `GET` | Returns TTS availability info for frontend. |

---

## 8. Installation

### Prerequisites

- **Node.js 18+** and **npm** (frontend)
- **Python 3.10+** and **pip** (backend)
- A browser that supports `MediaRecorder` and Web Audio (Chrome, Edge, Firefox, Safari)
- A microphone (for live voice calls)

### Clone the repository

```bash
git clone https://github.com/Sohail-AI-Architect/build-ai-voice-agent.git
cd build-ai-voice-agent
```

### Frontend setup

See the [Frontend Setup](#9-frontend-setup) section below.

### Backend setup

See the [Backend Setup](#10-backend-setup) section below.

---

## 9. Frontend Setup

```bash
cd frontend

# 1. Install dependencies
npm install

# 2. Optionally configure a non-default backend URL
#    Create frontend/.env.local (git-ignored) yourself and set NEXT_PUBLIC_BACKEND_URL:
#    NEXT_PUBLIC_BACKEND_URL=https://backend-three-neon-55.vercel.app

# 3. Run the development server
npm run dev

# 4. Build and preview in production
npm run build
npm run start
```

> **Note:** `NEXT_PUBLIC_BACKEND_URL` is optional — leaving it unset uses the production backend default from `src/lib/voice.ts` (`https://backend-three-neon-55.vercel.app`).

---

## 10. Backend Setup

```bash
cd backend

# 1. Create and activate a virtual environment
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure environment variables
#    Copy backend/.env.example to backend/.env and add your keys

# 4. Run the server
uvicorn main:app --reload
```

---

## 11. Environment Variables

| Variable | Purpose | Example / Default |
|---|---|---|
| `GROQ_API_KEY` | Groq API key (required) | `sk-...` (from https://console.groq.com/keys) |
| `GROQ_BASE_URL` | Groq endpoint | `https://api.groq.com/openai/v1` |
| `GROQ_MODEL_NAME` | Groq model | `openai/gpt-oss-20b` |
| `ELEVENLABS_API_KEY` | ElevenLabs API key (kept secret) | `...` (from https://elevenlabs.io/account/api-keys) |
| `ELEVENLABS_BASE_URL` | ElevenLabs endpoint | `https://api.elevenlabs.io/v1` |
| `ELEVENLABS_VOICE_ID` | ElevenLabs voice ID | `21m00Tcm4FMlY31M2d8D` |
| `ELEVENLABS_MODEL_ID` | ElevenLabs model ID | `eleven_multilingual_v2` |
| `ELEVENLABS_OUTPUT_FORMAT` | ElevenLabs output format | `mp3_44100_128` |
| `HOST` | Backend bind address | `0.0.0.0` |
| `PORT` | Backend port | `8000` |
| `RELOAD` | Hot-reload enable flag | `false` |
| `FRONTEND_ORIGINS` | Comma-separated frontend origins | `http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001` |
| `CORS_ALLOW_ALL_ORIGINS` | Allow all origins | `false` |
| `VERCEL_FRONTEND_ORIGIN` | Vercel production frontend | `https://frontend-two-flame-37.vercel.app` |

> **Important:** `ELEVENLABS_VOICE_ID` and `ELEVENLABS_API_KEY` are documented placeholders. The ElevenLabs TTS is **not** functional in this project. The browser `speechSynthesis` fallback is the intended, working path. See the [Troubleshooting](#19-troubleshooting) section for details.

---

## 12. Frontend-to-Backend Connection

- The frontend reads `NEXT_PUBLIC_BACKEND_URL` (from `frontend/.env.local` or the browser environment) and builds the API URL:

```ts
const BACKEND_URL = (process.env.NEXT_PUBLIC_BACKEND_URL || "https://backend-three-neon-55.vercel.app").replace(/\/+$/, "");
const VOICE_API_URL = BACKEND_URL;
```

- Every voice request goes to `${VOICE_API_URL}/api/voice/stream` using `POST`, `Content-Type: application/json`, with a JSON body containing `audio_base64`, `audio_mime`, `history`, `language: "auto"`, and `mode`.

- The browser must be served from `https` (or `http://localhost` for local development) because the microphone and Web Audio APIs require a secure context.

---

## 13. CORS Configuration

- The backend uses `CORSMiddleware` with `CORS_ALLOW_ALL_ORIGINS=false` and an explicit allowed origin: `https://frontend-two-flame-37.vercel.app`.
- In development, any host that needs to reach the backend must be added to the backend's `CORS` allow-list (the origin of the dev frontend).
- The frontend's `fetch` calls do not set a `credentials` mode; they send plain JSON requests and do not rely on cookies.

---

## 14. Voice Streaming API Endpoint

### `POST /api/voice/stream`

**Request body (JSON):**

```json
{
  "audio_base64": "base64-encoded-wav-webm",
  "audio_mime": "audio/webm;codecs=opus",
  "history": [],
  "language": "auto",
  "mode": "assistant"
}
```

**Validation:**

- `audio_base64` is required. A request with an empty body or no `audio_base64` returns `422 Unprocessable Entity` with `Field required: audio_base64`.
- `audio_mime` is accepted to carry the recorded audio type.

**Response:** `200` with `Content-Type: application/x-ndjson` (newline-delimited JSON, chunked). One JSON object per line, each carrying a `type` field:

| `type` | Meaning |
|---|---|
| `transcript` | The user's spoken transcript (echoed) |
| `sentence` | One sentence of the AI reply, optionally with its own `audio` segment |
| `done` | Streaming finished; `reply` carries the full AI reply |
| `error` | An error occurred; `detail`/`error` carry the message |

**Example:**

```json
{"type":"transcript","text":"Hello","language":"en"}
{"type":"sentence","text":"Hello there!","audio":"base64..."}
{"type":"done","reply":"Hello there! Can I help you with anything?"}
```

---

## 15. NDJSON Response Format

Every line of the stream is a JSON object with a `type` discriminator. The exact contract is:

| `type` | Structure |
|---|---|
| `transcript` | `{ "type": "transcript", "text": "...", "language": "en" \| "ur" }` |
| `sentence` | `{ "type": "sentence", "text": "...", "audio": "base64..." }` (audio optional; `error` within a sentence means TTS failed and the sentence text is still delivered) |
| `done` | `{ "type": "done", "reply": "..." }` |
| `error` | `{ "type": "error", "detail": "...", "error": "..." }` |

The frontend reader opens a `ReadableStream` reader, decodes chunks, splits on `\n`, and dispatches each event to the transcript, the sentence queue, and the playback player.

---

## 16. Groq and ElevenLabs Integration

### Groq

- The `lang` of the user's transcript is detected, then the corresponding Groq system prompt is resolved.
- The LLM streams the reply sentence by sentence back over the NDJSON stream.
- A fast, instruction-following model keeps replies in English and starts audio playback sooner.

### ElevenLabs

- When `ELEVENLABS_API_KEY` and a valid `ELEVENLABS_VOICE_ID` are configured, the agent calls ElevenLabs TTS to synthesize the reply audio.
- When the ElevenLabs voice is unavailable, the frontend falls back to the browser's built-in `speechSynthesis` so the reply is still spoken.

### Browser speech synthesis fallback

**Exact state:** ElevenLabs is **not** functional in this project. The browser fallback speaks the reply text with `utterance.lang` set to `en-US` or `ur-PK` depending on the detected language. This fallback is real, synchronous, and part of the voice loop.

---

## 17. Deployment Instructions and Troubleshooting

### Frontend deployment (Vercel)

1. Push the `frontend` project to your Vercel GitHub repository.
2. Set the environment variable `NEXT_PUBLIC_BACKEND_URL` on the project.
3. Deploy the `frontend` project; production runs at `https://frontend-two-flame-37.vercel.app`.

### Backend deployment (Vercel)

1. Push the `backend` project to your Vercel GitHub repository.
2. Set environment variables (`GROQ_API_KEY`, `GROQ_BASE_URL`, `GROQ_MODEL_NAME`, `ELEVENLABS_API_KEY`, `ELEVENLABS_BASE_URL`, `ELEVENLABS_VOICE_ID`, `CORS_ALLOW_ALL_ORIGINS`).
3. Deploy the `backend` project; production runs at `https://backend-three-neon-55.vercel.app`.

### Troubleshooting

| Issue | Resolution |
|---|---|
| **Mic permission denied / "NotAllowedError"** | Grant microphone access in the browser's site settings and reload. |
| **No audio / echo** | Turn off the device's "Listen for announcements" / voice access, or use a wired headset. |
| **Stream returns 422** | `POST /api/voice/stream` requires `audio_base64` in the body; the frontend sends it, but a direct `curl` must include it. |
| **Backend unreachable** | Verify `NEXT_PUBLIC_BACKEND_URL` in the frontend `.env.local` and the Vercel production environment; verify the backend CORS allow-list includes the frontend origin. |
| **ElevenLabs audio empty** | The configured `ELEVENLABS_VOICE_ID` is not valid in this project. The frontend falls back to the browser `speechSynthesis` fallback, which is the intended, working path. |
| **Build/typecheck failures** | Run `npm run lint`, `npx tsc --noEmit`, and `npm run build` in `frontend/`; the backend checks are `python -m py_compile` on the changed modules and `python -c "import main"` (see **Verification**). |

---

## 18. Security Notes

- API keys (`GROQ_API_KEY`, `ELEVENLABS_API_KEY`) are **never** printed in full or exposed in client-side bundles. Only masked fingerprints are displayed (e.g., `sk_7...31cd`).
- CORS is restricted to `https://frontend-two-flame-37.vercel.app` in production; `*` is never used with `allow_credentials=True`.
- The backend `/api/health` endpoint returns masked key fingerprints via the `diagnose()` function; full keys are never leaked in HTTP responses.
- The `/api/voices` endpoint returns a default list when the ElevenLabs API key is missing; it does not expose real voice listings.

---

## 19. License

This project is **unlicensed**. The backend `main.py` and `config.py` files are copyrighted 2026 Sohail Mahum. The frontend is copyrighted 2026 Sohail Mahum. No license file is provided; use of this code is subject to standard GitHub terms and the author's attribution requirements.

If you would like to add a license, please add a `LICENSE` file in the repository root with an appropriate open-source license (e.g., MIT, Apache 2.0).

---

## 20. Contribution Guidelines

1. **Fork** the repository and create a feature branch from `main`.
2. **Write** code that follows the existing style and conventions.
3. **Run** `npm run lint`, `npx tsc --noEmit`, and `npm run build` in `frontend/` to verify no regressions.
4. **Run** `python -m py_compile` on changed backend modules and `python -c "import main"` to verify backend syntax.
5. **Submit** a pull request with a clear description of the change, what problem it solves, and how it is tested.
6. **Do not** add fake features, fabricate performance numbers, or claim functionality that does not exist.
7. **Do not** commit secrets, API keys, or environment variable values.
8. **Do not** modify `.gitignore`, `backend/.env`, `backend/.env.example`, `freebuff.ps1`, `freebuff.sh`, `backend/uvicorn.log`, `frontend/next-env.d.ts`, or `frontend/tsconfig.tsbuildinfo`.

---

## 21. Contact

- **GitHub:** [@Sohail-AI-Architect](https://github.com/Sohail-AI-Architect)
- **Repository:** [build-ai-voice-agent](https://github.com/Sohail-AI-Architect/build-ai-voice-agent)
- **Live Demo:** [frontend-two-flame-37.vercel.app](https://frontend-two-flame-37.vercel.app)
- **Backend API:** [backend-three-neon-55.vercel.app](https://backend-three-neon-55.vercel.app)

---

## Repository Metadata (GitHub)

The following metadata has been set on GitHub:

- **Description:** AI Voice Agent | Real-time AI voice assistant built with Next.js, FastAPI, Groq and ElevenLabs, featuring real-time conversational voice interaction.
- **Homepage:** https://github.com/Sohail-AI-Architect/build-ai-voice-agent
- **Topics:** ai-voice-agent, voice-ai, conversational-ai, artificial-intelligence, nextjs, fastapi, groq, elevenlabs, typescript, python, speech-ai
- **Website:** https://github.com/Sohail-AI-Architect/build-ai-voice-agent

---

## Repository Topics Verification

The following topics accurately describe the code and have been added:

- `ai-voice-agent` — The project is an AI-powered voice agent
- `voice-ai` — Features voice AI and conversational voice interaction
- `conversational-ai` — Built for conversational AI interactions
- `artificial-intelligence` — Uses AI for voice processing
- `nextjs` — Frontend built with Next.js 16
- `fastapi` — Backend built with FastAPI
- `groq` — Integrates with Groq LLM
- `elevenlabs` — Integrates with ElevenLabs (TTS fallback)
- `typescript` — Frontend is written in TypeScript
- `python` — Backend is written in Python
- `speech-ai` — Features speech AI capabilities