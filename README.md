# Crayons AI Reel Studio

A Vite + React Reel concept studio with server-side AI endpoints.

## Features

- Generate a short-form Reel script, scene-by-scene storyboard, captions, and a video-generation prompt through OpenRouter's free-model router.
- Quota-aware text-model fallback: when a model returns an explicit quota/rate-limit response, the server tries configured free-only models in order.
- Optional real text-to-video generation through Hugging Face Inference Providers.
- Generated video is returned to the browser for the current session only; no database or Supabase persistence is used.
- API credentials are read only by server-side Vercel Functions. Never use `VITE_*` or `NEXT_PUBLIC_*` prefixes for secrets.

## Configure server-side environment variables

Set these in the Vercel project settings for a **Preview environment only** after reviewing the provider's current terms and pricing:

- `OPENROUTER_API_KEY` — server-side API key. The first text request uses `openrouter/free`.
- `OPENROUTER_FREE_FALLBACK_MODELS` — optional comma-separated list of OpenRouter model IDs explicitly marked with the `:free` suffix, for example `publisher/model:free,publisher/another-model:free`. The server ignores IDs that do not end in `:free` and tries at most five configured fallback models, in order, only after a quota/rate-limit response. Keep this list current with models actually available to your OpenRouter account.
- `HF_TOKEN` — Hugging Face token with Inference Providers permission, only if video generation is needed.
- `HF_VIDEO_MODEL` — optional model ID; defaults to `Wan-AI/Wan2.2-TI2V-5B`.
- `HF_VIDEO_PROVIDER` — optional provider identifier supported by Hugging Face for that model.
- `HF_VIDEO_FREE_TIER_CONFIRMED` — must be set to `true` only after the project owner confirms the chosen model/provider is available within an actual no-cost allowance. The video endpoint fails closed otherwise. Hugging Face Inference Providers are generally pay-as-you-go; do not assume a free quota.

Do not add keys to source control, frontend variables, issue comments, or logs. Do not use production credentials to test Preview. No Supabase configuration is required. Never configure paid models as fallbacks.

## Development

Requirements: Node.js 20+.

```bash
npm install
npm run dev
npm run build
```

The API routes under `api/` are Vercel serverless functions and require Vercel (or a compatible local function emulator) to run. The static Vite app can still be previewed locally, but the API routes will not be served by plain `vite preview`.

## Safety and cost notes

- Text AI starts with `openrouter/free`; if that request returns an explicit quota/rate-limit response, the server tries only the configured `:free` fallback model IDs. It does not switch models on authentication/configuration errors, policy errors, network errors, or general provider failures.
- Free model availability and limits can change. This is quota-aware fallback, not a guarantee of uninterrupted or unlimited free use. If all free models are exhausted, the app stops and asks the user to wait or update the verified free-model list; no paid fallback is attempted.
- Video generation is opt-in and fails closed until server-side provider settings are supplied and the owner explicitly confirms a genuine no-cost allowance. A confirmation flag alone does not technically prove billing status; review the provider dashboard before enabling.
- Prompts are sent to the configured AI provider. Do not submit confidential or personal data.
- This change does not create a database, store prompts, or add Supabase persistence.
- Open the draft PR and verify Preview behavior before considering any release. No merge or production promotion is authorized by this change.
