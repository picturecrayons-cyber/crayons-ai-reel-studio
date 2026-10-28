# Crayons AI Reel Studio

A minimal, safe starter for a prompt-to-Reel workflow.

## Current scope

- Prompt input and a local-only demo status flow
- A 30-second Reel preview placeholder
- Download action for a small demo text artifact
- No AI provider, database, credentials, or paid service configured

## Development

Requirements: Node.js 20+.

```bash
npm install
npm run dev
```

## Important

This starter does **not** generate real video yet. The preview is a UI placeholder. Connect an AI video provider only after reviewing its pricing, data handling, and API-key storage. Never put secrets in client-side code.

Deploy to a Vercel Preview environment for testing. Do not treat a successful build as production certification.
