# AI Voice Agent — Frontend

Concise frontend-only guide for the voice demo UI.

## Quick start

```bash
cd frontend
npm install
npm run dev
```

Open <http://localhost:3000>. No environment file is required: `src/lib/voice.ts` falls back to the production backend at `https://backend-three-neon-55.vercel.app`.

This project does **not** ship a `frontend/.env.example`, so there is no template to copy. If you need to point at a different backend, create `frontend/.env.local` yourself (it is git-ignored) and set `NEXT_PUBLIC_BACKEND_URL`:

```bash
NEXT_PUBLIC_BACKEND_URL=https://backend-three-neon-55.vercel.app
```

`NEXT_PUBLIC_BACKEND_URL` is optional — leave it unset to use the production backend default. The frontend builds its voice URL with the exact pattern used in `src/lib/voice.ts` (`BACKEND_URL` + `/api/voice/stream`).

## What you get

- **Live voice console** — tap the mic, speak, hear the agent reply and see the transcript.
- **Page composition** — `frontend/src/app/page.tsx` renders exactly four components plus a mode selector:
  - `components/layout/Header.tsx` — branding, a Live Demo badge, and a Backend Online / Offline badge.
  - `components/voice/VoiceOrb.tsx` — a 96 px state orb (idle, listening, processing, speaking, stopped) with a short hint label.
  - `components/voice/StatusIndicator.tsx` — the start/end call button and the mic turn-status chip.
  - `components/voice/ConversationPanel.tsx` — the ordered conversation transcript.
  - A mode selector that currently offers only the `assistant` option.
- **Status signals** — Live Demo and Backend Online / Offline live in the header; listening / processing / speaking / ended turn states live under the call button.
- **Voice engine** — MediaRecorder, VAD/silence detection, max turn length, audio conversion and base64 upload, NDJSON reader, playback queue, and browser `speechSynthesis` fallback.

The page does not have a hero, features section, how-it-works section, or footer.

## Testing

```bash
npm run lint
npx tsc --noEmit
npm run build
```
