# StockSense

A React (Vite) single-page app that lists Indian IPOs from the
[InvestorGain Live IPO GMP](https://www.investorgain.com/report/ipo-gmp-live/331/)
report and provides an **AI Analysis** for each IPO, plus **Trending Stocks**
(NSE top gainers/losers) and an **AI Stock Analysis** tool.

A small Node proxy (local) / Netlify Function (production) fetches and
normalizes third-party data server-side, since browsers cannot call the
upstream APIs directly due to CORS.

## Purpose

Give retail investors a single, fast view of live IPO data (GMP, ratings,
subscription, valuation, dates) with an optional automated AI summary. All
analysis is automated and **not investment advice**.

## Main capabilities

- List live IPOs as cards with search + filters (All / Open / Mainboard / SME / status).
- AI IPO analysis via OpenAI-compatible streaming endpoints.
- Trending stocks (NSE top gainers/losers) with a daily snapshot and history.
- AI "best pick" analysis over the trending list.
- AI fundamental analysis for any listed stock by name or ticker.
- Switch AI provider/model from a UI dropdown (choice persisted to `localStorage`).
- Light/dark theme, view persisted to `localStorage`.

## Technology stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite 5, react-markdown, remark-gfm |
| Backend | Node.js (`node:http`), ESM modules |
| Serverless | Netlify Functions (`@netlify/functions`), Netlify Blobs |
| Config | `dotenv` |
| Tooling | `concurrently`, Vite dev server |

See [ARCHITECTURE.md](ARCHITECTURE.md) and [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) for detail.

## Prerequisites

- Node.js 18+ (required for global `fetch`).
- npm.

## Installation

```powershell
npm install
```

## Configuration

Configuration lives in `server/config/index.js` (non-secret constants) and
environment variables loaded via `dotenv`. Create a `.env` file in the
repository root for local overrides. `.env` is git-ignored.

### Environment variables

All values below are placeholders — do not commit real secrets. AI is
multi-provider: a provider becomes active only when BOTH its API key and its
comma-separated models list are set. Every active model appears in the UI
dropdown.

| Variable | Purpose | Example |
|---|---|---|
| `PORT` | Local proxy port | `8787` |
| `GROQ_API_KEY` / `GROQ_BASE_URL` / `GROQ_MODELS` | Groq provider | key / `https://api.groq.com/openai/v1` / `llama-3.3-70b-versatile` |
| `GEMINI_API_KEY` / `GEMINI_BASE_URL` / `GEMINI_MODELS` | Gemini provider | key / default Gemini URL / `gemini-2.5-flash` |
| `OPENAI_API_KEY` / `OPENAI_BASE_URL` / `OPENAI_MODELS` | OpenAI provider | key / `https://api.openai.com/v1` / `gpt-4o-mini` |
| `AI_API_KEY` / `AI_BASE_URL` / `AI_MODELS` (or `AI_MODEL`) | Generic OpenAI-compatible ("custom") provider | key / base URL / model list |
| `AI_CACHE_TTL_MS` | AI response cache TTL in ms | `1800000` |
| `AI_REQUEST_TIMEOUT_MS` | Idle timeout per AI stream (ms) | `45000` |

> Each provider's `BASE_URL` has a sensible default; only the key + models are
> strictly required. If no provider is active, AI endpoints return `503`.

## Commands

| Command | Description |
|---|---|
| `npm run dev` | Start the Vite dev server (port 5173) |
| `npm run server` | Start the Node proxy (port 8787) |
| `npm start` | Run proxy + dev server together (`concurrently`) |
| `npm run build` | Build the production frontend to `dist/` |
| `npm run preview` | Preview the production build |

Test / lint / format commands: **To be confirmed** (no test, lint, or
formatter configuration is present in the repository).

## Usage

```powershell
npm install

# Terminal 1 — start the StockSense proxy (needs Node 18+)
npm run server

# Terminal 2 — start the React app
npm run dev
```

Open http://localhost:5173. The Vite dev server proxies `/api` to
`http://localhost:8787` (see `vite.config.js`).

To enable AI analysis, configure at least one provider in `.env` (key + models):

```
GEMINI_API_KEY=your-api-key
GEMINI_MODELS=gemini-2.5-flash
```

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| "Could not reach the StockSense proxy server." | Proxy not running — run `npm run server`. |
| AI analysis returns 503 | No AI provider active — set a provider's API key AND models. |
| Empty IPO list / `source: "error"` | Upstream InvestorGain fetch failed (IPO data is fetched live, not persisted). |
| Trending stocks fail | NSE may challenge the request; the service retries with a cookie handshake. |

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) — components, data flow, integrations.
- [CODING_GUIDELINES.md](CODING_GUIDELINES.md) — conventions observed in the code.
- [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) — directory map and change scenarios.

## Security

- Never commit `.env` or API keys; `.env` is git-ignored.
- AI provider keys are read server-side only and never exposed to the browser.
- The proxy sets permissive CORS (`Access-Control-Allow-Origin: *`) — review
  before exposing publicly.
- No authentication layer is present. **To be confirmed** whether one is intended.

## Contributing

Contribution guidelines are **To be confirmed** (no `CONTRIBUTING.md` present).
Follow the conventions in [CODING_GUIDELINES.md](CODING_GUIDELINES.md).

> Analysis is automated and not investment advice.
