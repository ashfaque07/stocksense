# Platform Deployment — What to Change

StockSense has a **platform-agnostic service layer** (`server/services/*`). The
parts that must change per hosting platform are:

1. **Entry / handler** — how requests reach the service layer.
2. **Routing** — `/api/*` proxy + SPA fallback to `index.html`.
3. **Persistent storage** — the trending snapshot (currently Netlify Blobs).
4. **Scheduler (cron)** — the 15-min trending refresh during market hours.
5. **Env vars** — AI keys/models and config.

Baseline today (Netlify) lives in:
- `netlify.toml` (build, redirects, functions)
- `netlify/functions/api.js` (Lambda-style handler)
- `netlify/functions/trending-refresh.js` (`schedule()` cron)
- `server/repositories/trendingRepository.js` (Netlify Blobs)
- `server/config/index.js` → `IS_SERVERLESS`, `TRENDING_FILE`

Common to every platform:
- **Node 18+** (global `fetch`, `node:` built-ins).
- Set env: `GROQ_API_KEY`/`GROQ_MODELS`, `GEMINI_API_KEY`/`GEMINI_MODELS`,
  `NVIDIA_API_KEY`/`NVIDIA_MODELS`, `PORT` (where applicable).
- Build frontend: `npm run build` → serve `dist/`.

---

## 1. Render

**Model:** long-lived Node server (Web Service) + static site (optional).

| Concern | Change |
|---|---|
| Entry | Use existing `server/index.js` (`npm run server`). No handler rewrite. |
| Routing | Serve `dist/` statically + proxy `/api/*` to the Node server. Either one Web Service serving both, or a Static Site (frontend) + Web Service (API). Add SPA fallback to `index.html`. |
| Storage | `IS_SERVERLESS` is `false` → falls back to `server/data/trending.json`. Add a **Render Persistent Disk** mounted at the data path, OR swap the repository to Redis/Postgres. Without a disk the snapshot is lost on restart. |
| Scheduler | Netlify `schedule()` won't run. Add a **Render Cron Job** that hits an API refresh endpoint, or run `node-cron` inside the server. |
| Env | Set keys in Render dashboard. `PORT` is injected by Render — keep `process.env.PORT`. |

**Add:** `render.yaml` (optional blueprint). **Remove/ignore:** `netlify.toml`, `netlify/functions/*`.

---

## 2. Railway

**Model:** long-lived Node server (same as Render).

| Concern | Change |
|---|---|
| Entry | Existing `server/index.js`. No handler rewrite. |
| Routing | Single service serving `dist/` + `/api/*`, or split into two services. SPA fallback to `index.html`. |
| Storage | `IS_SERVERLESS` false → local JSON file. Attach a **Railway Volume** mounted at the data directory, OR use the Railway Redis/Postgres plugin and swap the repository. |
| Scheduler | Use a **Railway Cron** service (separate service with a cron schedule) calling the refresh endpoint, or `node-cron` in-process. |
| Env | Set in Railway Variables. `PORT` is provided by Railway — keep `process.env.PORT`. |

**Add:** `railway.json`/`nixpacks.toml` (optional). **Remove/ignore:** `netlify/*`.

---

## 3. Docker (self-host / VPS / any container host)

**Model:** long-lived Node server in a container.

| Concern | Change |
|---|---|
| Entry | Existing `server/index.js`. Container CMD runs `npm run server` after `npm run build`. |
| Routing | Serve `dist/` from the Node server (or put Nginx in front for static + `/api/*` proxy). SPA fallback to `index.html`. |
| Storage | `IS_SERVERLESS` false → `server/data/trending.json`. Mount a **named volume** at the data dir so the snapshot survives container restarts. |
| Scheduler | No platform cron. Use **host crontab** / a sidecar hitting the refresh endpoint, or `node-cron` inside the process. |
| Env | Pass via `-e` / `--env-file` / compose `environment:`. Expose `PORT` and publish it. |

**Add:** `Dockerfile`, `.dockerignore`, optional `docker-compose.yml` (app + volume). **Remove/ignore:** `netlify/*`.

---

## 4. Vercel

**Model:** serverless functions + static hosting (closest to Netlify, but different APIs).

| Concern | Change |
|---|---|
| Entry | Rewrite handler to Vercel signature `(req, res)` under `api/` (e.g. `api/[...path].js`), delegating to the same `server/services/*`. Don't reuse the Lambda-style `event.httpMethod` handler as-is. |
| Routing | Replace `netlify.toml` redirects with **`vercel.json`** `rewrites`: `/api/*` → the function, and SPA fallback `/* → /index.html`. |
| Storage | Netlify Blobs not available. Swap `trendingRepository.js` to **Vercel KV** (Redis) or Vercel Blob. Extend `IS_SERVERLESS` to detect `process.env.VERCEL`. |
| Scheduler | Replace `schedule()` with **Vercel Cron** (defined in `vercel.json`) calling a refresh route. Note: hobby plan cron granularity is limited. |
| Env | Set in Vercel Project Settings. `PORT` is not used (serverless). |

**Add:** `vercel.json`, `api/` function(s), KV adapter. **Remove/ignore:** `netlify/*`, `netlify.toml`.

---

## Quick comparison

| | Render | Railway | Docker | Vercel |
|---|---|---|---|---|
| Handler rewrite | No | No | No | **Yes** |
| Routing config | Service/static rules | Service rules | Nginx/server | `vercel.json` |
| Storage change | Disk or DB | Volume or DB | Volume | **KV/Blob (required)** |
| Cron change | Render Cron / node-cron | Railway Cron / node-cron | host cron / node-cron | Vercel Cron |
| Effort | Low | Low | Low–Med | Medium |

**Lowest effort:** Render / Railway / Docker (run the existing server, add
persistent storage + a cron). **Vercel** needs a handler + storage + cron adapter
but no logic rewrite.
