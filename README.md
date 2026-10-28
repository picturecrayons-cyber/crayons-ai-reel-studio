# Crayons AI Reel Studio

A free-first, browser-rendered vertical Reel builder. This branch starts moving the starter UI toward a real downloadable MP4 workflow without adding a paid fallback, database, or deployment.

## What this branch adds

- Editable three-scene storyboard with captions and per-scene duration.
- Free-tier-only Gemini storyboard endpoint (gemini-3.8-flash, then gemini-3.6-flash) with quota-aware model fallback.
- Local template storyboard fallback when the API is missing, unavailable, or quota-limited.
- Browser-side MP4 encoding with FFmpeg.wasm; rendering is performed on the user's device.
- Optional user-provided audio track; audio is processed in the browser and is not uploaded to the app API.
- Server-side API key access only. No key is bundled into client code.
- Build verification only. No deployment workflow.

## Local development

Requires Node.js 20+.

    npm install
    npm run dev
    npm run build

The AI endpoint is a Vercel-style serverless function at api/storyboard.js. A plain Vite dev server does not run this function, so local development will use the local storyboard fallback unless a compatible API runtime is used.

## Enabling free AI safely

The endpoint is disabled by default. Before enabling it, create a Google AI Studio project that is confirmed to be on the Free Tier with billing disabled. Then configure server-side environment variables in a dedicated non-production Preview environment:

- GEMINI_API_KEY: server-side key only; never use a VITE_ prefix.
- GEMINI_FREE_TIER_CONFIRMED=true: explicit operator assertion that the project is free-tier and billing is disabled.

Do not set these variables until the provider project and billing state have been independently checked. The assertion flag is not a technical proof of billing status. If free-tier-only status cannot be established, leave the endpoint disabled. The endpoint allowlists only the two models above and never switches to a paid provider. Quota/rate-limit errors move to the next allowlisted model; if both are exhausted, it stops and tells the user to wait.

Google free-tier limits, model availability, terms, and data handling can change. This prototype does not promise unlimited free capacity, commercial SLA, or privacy terms beyond those of the selected provider. Prompts sent to Gemini are handled under Google's applicable API terms. Do not submit sensitive customer data.

## MP4 export behavior and limitations

- The browser downloads the FFmpeg.wasm core on the first export; this requires a network connection and browser memory.
- MP4 video frames are composed locally from designed backgrounds and editable captions. This is an actual MP4 file, but this initial slice does not generate AI moving footage or AI-created photographs.
- If audio is attached, it is muxed locally into the MP4. Use only audio you have the rights to use.
- Browser capability and memory vary; large reels may fail on low-memory devices.
- The current scene visuals are stylized graphic compositions, not stock images or AI video.

## Safety and release status

- No paid fallback is implemented.
- No secrets, environment variables, databases, or production settings were changed by this branch work.
- No merge or deployment is authorized by this PR.
- Build success is not runtime, security, or production certification.
