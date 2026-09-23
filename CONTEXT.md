# Branchroom — Project Context (for anyone who only has this repo)

> This file captures the full context of the work done so far: what exists, why it
> exists, what was decided, and what comes next. Read this before touching the code.

## 1. What Branchroom is

A **personal learning workspace** that turns linear AI chat into a learning tree:
highlight any passage in an AI answer and open a separate, nested conversation
anchored to that exact quote. The main thread keeps its place; each side question
gets its own focused branch with breadcrumbs, a searchable tree sidebar, independent
drafts/scroll positions, and "understood" flags per branch.

- App: `app/workspace.tsx` (UI + selection-to-branch logic)
- Context engine: `lib/learning.ts` (`contextFor()` — the core algorithm)
- Backend: Cloudflare Worker (`worker/app.ts`), D1 storage, Drizzle migrations
- Model: self-hosted, open-weights **Kimi** on Modal (OpenAI-compatible endpoint),
  configured in `lib/provider-config.ts`

## 2. The core idea (Way 1: context selection)

`contextFor()` does NOT send the whole tree to the model. It:
1. Walks only the **direct ancestor chain** of the active branch (siblings excluded).
2. For each ancestor, includes the branch title, the originally highlighted passage
   (≤3,000 chars), and a **windowed excerpt** of the frozen source snapshot centered
   on that passage (~1,800 chars, 45% before the selection).
3. Caps total ancestry excerpts (~12,000 chars) and recent branch messages
   (last 12, per-message cap, ~24,000 char budget).

A benchmark harness (`scripts/context-experiment.mjs`, run
`npm run experiment:context`) measured **~93.5% input-token reduction** vs
full-history prompting (6,729 → 435 tokens, character-estimated, dry-run; needs a
live-model validation run). Context cost stays O(depth), not O(tree).

## 3. The 5-Ways mental model (how we think about LLM context)

| Way | Layer | In this project |
|---|---|---|
| 1. Text selection | the request (`messages[]`) | `contextFor()` — implemented |
| 2. Window/architecture | serve flags (max-model-len, RoPE) | Modal server-side — not yet touched |
| 3. Weights | LoRA fine-tuning (W' = W + A·B) | planned: 7B persona on RTX 4090 |
| 4. KV-cache | prefix caching, fp8 KV | app-side design is cache-friendly; server flag unverified |
| 5. Orchestration | multi-call systems, sub-agents | future (compressor agent for understood branches) |

## 4. Work done so far (this engagement)

- ✅ App located, built and run locally (dev: `npm run build` then `npm run dev`;
  requires **Node ≥ 22.13** — the local system Node 20 fails; use any modern runtime)
- ✅ **GitHub repo created (PRIVATE)** and initial commit pushed:
  `https://github.com/MASUM41/branchroom`, branch `codex/branchroom`
- ✅ Full backup on local drive D: (`D:\branchroom-backup\he`)
- ✅ Invention disclosure drafted (select-to-branch + bounded-ancestry context)
- ✅ Compute budget with phased plan and spend caps
- ✅ Resume/portfolio descriptions written
- ✅ Learning demos built (runnable): attention math, layer-to-layer passing, LoRA
  mechanics, plus an interactive embedding/attention visualizer (HTML)

**Note:** the docs and demos live in `outputs/` which is **gitignored** (kept local
on purpose, since the disclosure is patent-sensitive). Key ones:
`outputs/invention-disclosure.md`, `outputs/compute-budget.md`,
`outputs/resume-description.md`, `outputs/context-handoff.md`,
`outputs/attention-demo.mjs`, `outputs/layers-demo.mjs`, `outputs/lora-demo.mjs`,
`outputs/embedding-visualizer.html`.

## 5. Agreed roadmap (the build order)

1. **Way 4, app-side** — audit `contextFor()` for prefix stability; reorder if needed
   so prefix caching can hit (stable content first).
2. **Way 1 upgrade** — *understanding-aware compression*: branches marked
   "understood" collapse to one-line known-facts instead of full excerpts.
3. **Benchmark** — expand `scripts/context-experiment.mjs` to more scenarios with
   quality scoring; validate the ~93.5% claim on live runs.
4. **Way 4, server-side** — verify/enable prefix caching on the Modal deployment
   (blocked: deployment code/auth not on the dev PC; check Modal dashboard).
5. **Way 3** — LoRA fine-tune a 7B open model as a teaching persona (on the RTX 4090
   machine; NOT on the ~1T Kimi — that is lab-scale money).

## 6. Guardrails

- **Keep this repo PRIVATE.** A patent filing for the select-to-branch mechanism is
  under consideration; public disclosure before filing can destroy patentability
  (absolute-novelty jurisdictions).
- Never commit secrets (`.env*` is gitignored; keep it that way).
- Do not modify applied Drizzle migrations (`drizzle/0000_*.sql`); append new ones.
- Validation: `node scripts/check-app.mjs` and
  `node node_modules/typescript/bin/tsc -p tsconfig.app.json --noEmit`.

## 7. Open questions

- What GPU/config does the Modal deployment actually run, and is prefix caching on?
- Prior-art search status for the disclosure.
- Where to point the app for a local 7B (Ollama/vLLM) for free experiments.
