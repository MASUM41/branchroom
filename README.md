# Branchroom

A personal learning workspace: select text in an answer, explore it in a separate conversation, and branch again without losing the main thread.

## Features

- Main conversation and active explanation side by side on desktop.
- Nested branches with source passages, breadcrumbs, and a searchable tree.
- Independent drafts and reading positions when switching branches.
- Streamed Kimi answers, stop/retry controls, and an explicitly labelled guided demo.
- Server-backed saved trees, account isolation, and protection against conflicting saves from multiple tabs.
- Markdown, code blocks, tables, and mathematical notation.
- Mark understood, rename/delete branches, and export a JSON backup.
- Responsive phone interface, keyboard-accessible dialogs, and select-to-explain.

## Run locally

Requires Node.js 22.13 or later. Install dependencies with `npm ci`, then run `npm run build` and `npm run dev`. Open the printed loopback URL.

If the Windows sandbox blocks installation helper pipes, dependencies can be installed with `npm ci --ignore-scripts`; this app's build invokes the installed platform compiler directly and does not require the blocked helper services.

The local preview runs only on 127.0.0.1 and uses a local test identity. Its SQLite database is in the ignored `.sites-runtime` directory. Production identity is supplied by the private Sites gateway, and production learning trees are stored per user in D1. Local and hosted data are separate.

## Connect Kimi

Open Settings and choose Modal for your self-hosted deployment (selected by default), or choose a Moonshot region. The supplied Modal endpoint is preconfigured. For Modal, enter a Proxy Token as TOKEN_ID.TOKEN_SECRET, then load the available models and select the exact served model ID. The endpoint currently requires proxy authentication. Keys entered in the interface stay in tab memory and are cleared on reload. Model selection is remembered locally. Keys are sent only to the app server and then to the selected model endpoint. A Moonshot server key is never automatically forwarded to Modal.

For a persistent server-side connection, copy `.env.example` to `.env` locally, or configure `MODAL_API_KEY` and `MODAL_MODEL` for this deployment, or `KIMI_API_KEY` and `KIMI_MODEL` for Moonshot. Mark the hosted API key secret. Never put a key in source control.

No real Kimi API key was supplied during implementation. The proxy's authentication, errors, request format and streaming response were tested with a controlled fixture; an actual provider response must be verified with your account.

## Architecture

React 19 and TypeScript, Tailwind CSS, Radix/shadcn dialogs and buttons, a Cloudflare-compatible Worker, D1, and Drizzle-generated schema migrations. The project started from the Sites starter, with a small standalone build and loopback preview added because the local Windows sandbox blocks the framework's subprocess pipes. The installed starter and framework files are retained; production uses `app/client.tsx` and `worker/app.ts`.

`lib/learning.ts` constructs the active branch's history and relevant ancestry. Sibling branches are excluded. Source passages and snapshots are retained at branch creation. Long context is bounded rather than sending an entire learning tree on every question.

`app/api/workspace/route.ts` scopes reads and writes to gateway-authenticated users and uses revision checks to prevent overwriting another tab's saves. `app/api/provider/route.ts` validates inputs and forwards streaming requests to the supplied Modal deployment or the official global/China Moonshot endpoint.

## Validation

Run `node scripts/check-app.mjs` for ancestry, isolation, persistence, conflict, authentication and streaming-contract checks. Run `node node_modules/typescript/bin/tsc -p tsconfig.app.json --noEmit` for the active application's type check.

The browser flow was also checked for nested branch creation, selection controls, navigation, persisted state after reload, and desktop/mobile layout. Agent-facing WebMCP read and navigation tools were checked with valid and invalid input.

The initial migration is `drizzle/0000_learning_workspaces.sql`. Do not regenerate or modify applied migrations; append new Drizzle migrations for later schema changes.

