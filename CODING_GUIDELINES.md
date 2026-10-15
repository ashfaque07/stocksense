# Coding Guidelines

Conventions observed in this repository. Related docs:
[README.md](README.md) · [ARCHITECTURE.md](ARCHITECTURE.md) · [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)

## Naming conventions

| Element | Convention | Example |
|---|---|---|
| Variables / functions | camelCase | `fetchLiveRows`, `normalizeRow` |
| React components | PascalCase | `IpoCard`, `AnalysisModal` |
| Hooks | `use` prefix, camelCase | `useIpos`, `useAnalysis` |
| Constants | UPPER_SNAKE_CASE | `API_HOST`, `STATUS_MAP`, `NSE_HOLIDAYS` |
| Controller handlers | `handle` prefix | `handleGetIpos`, `handleAnalyze` |

## File & folder conventions

- ES modules everywhere (`"type": "module"`); imports include the `.js`/`.jsx` extension.
- React component files use `.jsx`; one component per file, default export.
- Backend is layered by folder: `config`, `utils`, `models`, `services`,
  `repositories`, `controllers`, `routes`.
- Frontend mirrors concerns: `components`, `hooks`, `services`, `constants`, `styles`.
- Files open with a short comment describing the module's role.

## Function & class design

- No classes; prefer small, single-purpose functions and factory-style helpers.
- Services export named async functions; async generators (`function*`) are used
  for streaming AI tokens (`streamAnalysis`, `streamCompletion`).
- Keep controllers thin — delegate to services and only shape the HTTP response.
- React components are function components composed in `App.jsx`.

## API conventions

- Routes are matched by URL prefix in `server/routes/router.js` and by
  `path.includes(...)` in the Netlify Function.
- JSON responses use `Content-Type: application/json`; AI text uses
  `text/plain; charset=utf-8`.
- Status codes observed: `200`, `204` (OPTIONS), `400` (bad body), `405`
  (wrong method), `404`, `502`/`503` (upstream/AI failures).
- Client calls hit relative `/api/*` paths (proxied by Vite in dev).

## Async programming

- Use `async`/`await`; global `fetch` (Node 18+).
- Stream responses via `ReadableStream` readers / async generators.
- Implement retry-with-backoff and fallback for transient upstream errors
  (see `streamCompletion`, `fetchNseJson`).

## Error handling

- Wrap external calls in `try/catch`; degrade gracefully to cached/fallback data.
- Return structured error payloads (`{ source: 'error', error }`) rather than throwing to the client.
- Log server-side failures with `console.error` including a module tag, e.g. `[ipos] Blob read failed:`.

## Logging

- `console.log` for lifecycle/info, `console.error` for failures. No logging
  framework is configured.

## Input validation

- Validate JSON bodies and required fields in handlers (e.g. reject missing
  `ipo.company` or empty `query` with `400`).
- Normalize/sanitize upstream data at the model layer (`stripTags`,
  `decodeEntities`, `clean`).

## Security guidance

- Never hardcode or commit secrets; read keys from env (`AI_API_KEY`). `.env` is git-ignored.
- Keep third-party calls server-side to avoid exposing keys/CORS issues.
- Review the permissive `*` CORS policy before public deployment.
- Do not log secrets or full request bodies.

## Testing expectations

No test framework or tests are present. **To be confirmed.** If added, colocate
or use a `tests/` folder and document the command in [README.md](README.md).

## Dependency management

- npm with a pinned `package.json`; runtime deps vs `devDependencies` separated.
- Node 18+ required (global `fetch`). Prefer built-in `node:` modules
  (`node:http`, `node:fs/promises`, `node:path`, `node:url`).

## Code review checklist

- [ ] Layer boundaries respected (controller → service → repository).
- [ ] Import paths include file extensions.
- [ ] External calls have try/catch, retries, and fallbacks where appropriate.
- [ ] No secrets committed; env vars used for config.
- [ ] Errors returned as structured payloads with correct status codes.
- [ ] New constants added to `server/config/index.js`.
- [ ] Data from upstream is normalized/sanitized before use.

## Guidance for AI coding assistants

- Follow existing layering; do not put business logic in controllers or components.
- Reuse `streamCompletion(messages, key, selectedModel, options)` in
  `analysisService.js` for any new AI feature rather than duplicating fetch/retry logic.
- Put fixed markdown prompt templates in `server/services/prompts.js`.
- Add AI providers/models and other config to `server/config/index.js`; read
  secrets from env (`*_API_KEY`). A provider is active only with a key AND models.
- Preserve the fixed markdown prompt templates unless explicitly changing output format.
- Match existing style: ESM, camelCase, leading module comment, extension-qualified imports.
- Ignore generated folders (`node_modules`, `dist`) and never commit `.env`.

## Example patterns

Structured fallback (from `ipoService.js`):

```js
const live = await fetchLiveRows()
if (live) {
  return { source: 'live', count: live.length, ipos: live }
}
return { source: 'error', count: 0, ipos: [], error: '...' }
```

Thin controller (from `ipoController.js`):

```js
export async function handleGetIpos(req, res) {
  const data = await getIpos()
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(data))
}
```
