# Project Structure

Related docs: [README.md](README.md) · [ARCHITECTURE.md](ARCHITECTURE.md) · [CODING_GUIDELINES.md](CODING_GUIDELINES.md)

## Directory tree

```
stocksense/
├─ index.html                  # Vite HTML entry
├─ vite.config.js              # Vite config + /api dev proxy
├─ netlify.toml                # Netlify build, functions, redirects
├─ package.json                # Scripts + dependencies
├─ netlify/
│  └─ functions/
│     ├─ api.js                # Native Netlify Function (all /api routes)
│     └─ trending-refresh.js   # Scheduled cron: refresh trending snapshot
├─ server/                     # Local proxy (layered backend)
│  ├─ index.js                 # HTTP server bootstrap
│  ├─ config/index.js          # Constants + multi-provider AI config + serverless detection
│  ├─ controllers/             # HTTP response mapping (ipo, analysis, stock, trending, trending-analysis, models)
│  ├─ services/                # Business logic (fetch, normalize, AI, market); prompts.js holds prompt templates
│  ├─ repositories/            # Trending + holiday persistence (Netlify Blobs / JSON)
│  ├─ models/ipo.js            # Raw row → clean IPO
│  ├─ routes/router.js         # URL-prefix routing + CORS
│  ├─ utils/                   # html.js, parsers.js
│  └─ data/                    # Local JSON store (trending.json)
└─ src/                        # React frontend
   ├─ main.jsx                 # React entry point
   ├─ App.jsx                  # Root composition
   ├─ components/              # UI components (incl. Modal, ModelSelector)
   ├─ hooks/                   # Data + state hooks
   ├─ services/               # API clients (incl. modelApi.js)
   ├─ constants/ui.js          # FILTERS + ICONS
   └─ styles/styles.css        # App styles
```

## Purpose of major folders

| Folder | Purpose |
|---|---|
| `netlify/functions/` | Production serverless handlers |
| `server/` | Local Node proxy sharing the service layer |
| `server/config/` | Centralized constants and env configuration |
| `server/controllers/` | Thin HTTP adapters over services |
| `server/services/` | Core business logic, AI streaming, and external integrations |
| `server/repositories/` | Storage backends for trending/holidays (Blobs vs local JSON) |
| `server/models/` | Data normalization |
| `server/utils/` | Parsing/decoding helpers |
| `src/components/` | React UI |
| `src/hooks/` | Data fetching and derived state |
| `src/services/` | Frontend API clients |

## Entry points

| Entry point | Role |
|---|---|
| `index.html` → `src/main.jsx` → `src/App.jsx` | Frontend |
| `server/index.js` | Local backend |
| `netlify/functions/api.js` | Production API |
| `netlify/functions/trending-refresh.js` | Scheduled job |

## Where things live

| Concern | Location |
|---|---|
| Controllers | `server/controllers/*.js` |
| Services | `server/services/*.js` |
| AI prompt templates | `server/services/prompts.js` |
| AI provider/model config | `server/config/index.js` (`AI_PROVIDERS`, `AI_MODELS`) |
| Repositories | `server/repositories/*.js` |
| Models | `server/models/ipo.js` |
| Utilities | `server/utils/{html,parsers}.js` |
| Configuration | `server/config/index.js`, `netlify.toml`, `vite.config.js` |
| Frontend API clients | `src/services/*.js` |
| UI constants (filters, icons) | `src/constants/ui.js` |
| Scripts | `package.json` (`scripts`) |
| Tests | None present — **To be confirmed** |

## Common change scenarios

| Goal | Files typically involved |
|---|---|
| Change IPO field parsing | `server/models/ipo.js`, `server/utils/parsers.js` |
| Add/adjust an API route | `server/routes/router.js`, `netlify/functions/api.js`, matching controller |
| Modify AI prompt/output | `server/services/prompts.js` (templates) + relevant analysis service |
| Add an AI provider/model | `server/config/index.js` + `.env` (`*_API_KEY`, `*_MODELS`) |
| Change trending snapshot storage | `server/repositories/trendingRepository.js`, `server/config/index.js` |
| Adjust trending schedule/gating | `netlify/functions/trending-refresh.js`, `server/services/trendingService.js` |
| Add a UI view/filter/icon | `src/App.jsx`, `src/components/*`, `src/constants/ui.js` |
| Add config/env var | `server/config/index.js`, `README.md` (env table) |

## What AI assistants should ignore

- `node_modules/`, `dist/` (generated).
- `.env` and any real secrets.
- `server/data/*.json` runtime data (trending snapshot) — do not treat as source of truth.

## Locating code before a change

1. Start at the entry point for the layer (frontend `App.jsx`, backend `router.js` / `api.js`).
2. Follow the route to its controller, then service, then repository/model.
3. For UI, trace `App.jsx` → component → hook → `src/services` client.
4. Check `server/config/index.js` for relevant constants/env vars first.
