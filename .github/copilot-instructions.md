# Copilot Instructions — StockSense

React (Vite) SPA + Node proxy that normalizes third-party IPO/stock data and
adds AI analysis. The same service layer runs locally (`server/index.js`) and on
Netlify Functions (`netlify/functions/api.js`).

For detail see [ARCHITECTURE.md](../ARCHITECTURE.md),
[CODING_GUIDELINES.md](../CODING_GUIDELINES.md),
[PROJECT_STRUCTURE.md](../PROJECT_STRUCTURE.md), and [README.md](../README.md).

## Core rules

- ESM everywhere (`"type": "module"`); imports MUST include the `.js`/`.jsx` extension.
- Node 18+; use global `fetch` and `node:` built-ins (`node:http`, `node:fs/promises`).
- Respect the backend layering: `routes/controllers → services → repositories/models`.
  Keep controllers thin; put business logic in services.
- React: function components, PascalCase files (`.jsx`), one component per file,
  default export; hooks use the `use` prefix.
- Naming: camelCase (vars/functions), UPPER_SNAKE_CASE (constants),
  `handle*` (controllers).

## Conventions

- Add configuration constants and AI provider/model config to `server/config/index.js`.
- Read secrets from env (`*_API_KEY`); never hardcode or commit keys. `.env` is git-ignored.
  An AI provider is active only when its `*_API_KEY` AND `*_MODELS` are set.
- Reuse `streamCompletion(messages, key, selectedModel, options)` in
  `server/services/analysisService.js` for any new AI feature — do not duplicate
  fetch/retry/fallback logic. Put prompt templates in `server/services/prompts.js`.
- Wrap external calls in `try/catch` with retry/backoff and graceful fallback;
  return structured error payloads (e.g. `{ source: 'error', error }`) with correct
  status codes (`400`/`405`/`502`/`503`).
- Normalize/sanitize upstream data at the model layer (`stripTags`, `decodeEntities`).
- Log with `console.error` using a module tag, e.g. `[ipos] ...`.
- Keep the fixed markdown prompt templates unless explicitly changing output format.
- When adding an `/api/*` route, update BOTH `server/routes/router.js` and
  `netlify/functions/api.js`, plus the matching controller.

## Where to change things

| Goal | Files |
|---|---|
| IPO field parsing | `server/models/ipo.js`, `server/utils/parsers.js` |
| API route | `server/routes/router.js`, `netlify/functions/api.js`, controller |
| AI prompt/output | `server/services/prompts.js` + relevant analysis service |
| AI provider/model | `server/config/index.js`, `.env` (`*_API_KEY`, `*_MODELS`) |
| Trending storage | `server/repositories/trendingRepository.js`, `server/config/index.js` |
| Trending schedule | `netlify/functions/trending-refresh.js`, `server/services/trendingService.js` |
| UI view/filter/icon | `src/App.jsx`, `src/components/*`, `src/constants/ui.js` |

## Ignore

`node_modules/`, `dist/`, `.env`, and `server/data/*.json` (runtime trending data, not source of truth).

## Not present (do not invent)

No test, lint, or formatter configuration exists. No auth layer. IPO data is
fetched live (not persisted). Do not add commands, env vars, or tooling that
aren't in the repo without asking.
