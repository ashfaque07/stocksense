# Auto Trading Reference

Personal reference for how StockSense auto trading works. No secrets are stored here.
Source of truth is the code; file paths are listed so you can verify any rule.

## 1. Big picture

```
Trending gainers snapshot (NSE, every ~15 min)
        |
        v
AI picks the best 3 gainers  ->  stock flagged `aiRecommended`
        |
        v
Intraday screener scores the stock and assigns a STAGE
        |
        v
Stage is a BUY stage (IMMINENT / COILING)  ->  ENTRY (market order, intraday)
        |
        v
Every minute: check price  ->  EXIT on stop-loss / target / 15:15 square-off
```

Trades go: NSE data -> app -> VM relay (static IP) -> Upstox.

## 2. Entry criteria (all must be true)

A stock is bought only when **every** condition below holds
(`findSignals()` and `enter()` in `server/services/tradeService.js`):

| # | Condition | Where |
|---|---|---|
| 1 | Today's trending **gainers** snapshot exists (a snapshot from a previous day is ignored) | `findSignals` |
| 2 | Stock is **AI recommended** (`aiRecommended = true`) | `trendingService.js` |
| 3 | Stock is **not stale** (it is still in NSE's current gainers list) | `findSignals` |
| 4 | Stock has an **ISIN** (needed to build the Upstox instrument key `NSE_EQ|<ISIN>`) | `findSignals` |
| 4b | Stock is in the regular **`EQ` series** (BE/BZ/SM etc. cannot be traded intraday) | `findSignals` |
| 5 | Screener **stage** is in `AUTO_TRADE_STAGES` (default `IMMINENT,COILING`) | `findSignals` |
| 6 | Stock has **not hit its upper circuit today** (`uc` not set) | `findSignals` |
| 7 | Live price is **below the upper circuit** | `enter` |
| 8 | A last price is available from NSE | `enter` |
| 9 | `floor(AUTO_TRADE_CAPITAL / price) >= 1` (you can afford at least 1 share) | `enter` |
| 10 | The stock has **not already been traded today** (one trade per symbol per day) | `reserveTrade` (DB unique key) |
| 11 | Time is between **09:30 and 15:15 IST** | `runCycle` |
| 12 | Open + closed trades today are below `AUTO_TRADE_MAX_POSITIONS` | `runCycle` |
| 13 | Market is open and today is not an NSE holiday | `runCycle` |

Candidates are tried best screener score first.

Note on #12: the count includes trades already closed today, so `MAX_POSITIONS`
is effectively "max trades per day", not "max simultaneously open".

## 3. Where the AI recommendation comes from

- During each trending refresh, `recommendBestSymbols()` in
  `server/services/trendingAnalysisService.js` asks the AI to pick the **best 3**
  stocks from the fresh gainers list.
- The AI call runs at most every **5 minutes** (`AI_PICK_INTERVAL_MIN`); refreshes
  in between only update prices.
- Once flagged, a stock stays `aiRecommended` for the rest of the day
  (`aiRecommendedAt` records when).
- If the AI is unconfigured or fails, nothing new is flagged. Then no trades fire.
- Prompt text lives in `server/services/prompts.js`.

## 4. Screener stages

Source: `stageAt()` in `src/utils/intradayScreener.js`. Evaluated on the latest
snapshot using the stock's history of snapshots for the day.
Checks run in this order and the first match wins:

| Stage | Meaning | Rule |
|---|---|---|
| `HIT` | At upper circuit | Last price >= upper circuit |
| `AVOID` | Weak / fading | Price below VWAP, **or** 4 straight lower highs, **or** turnover flat (<=1% growth over 4 snapshots) while gain is 6% to under 17% |
| `IMMINENT` (**BUY**) | Strong move accelerating | Gain >= 15% **and** (turnover grew >= 15% since last snapshot **or** gain jumped >= 3 points since last snapshot) |
| `COILING` (**BUY**) | Holding a high band | Last 3 snapshots all with gain 12% to 17%, turnover rising, price >= 1.5% above VWAP, no meaningful dip (latest gain not more than 0.5 below the earlier two) |
| `CANDIDATE` | Early strength | Gain >= 6%, price above VWAP, turnover up vs previous snapshot |
| `NONE` | Nothing | Everything else |

Only `IMMINENT` and `COILING` trigger a buy by default. `CANDIDATE` does not.

Consequences worth knowing:
- `COILING` needs at least **3 snapshots** of history and `AVOID` needs **4**, so a
  stock that first appears late in the day cannot reach `COILING` quickly.
- The strategy buys stocks already up **12% to 17%+** that are pushing toward the
  upper circuit. Moves can reverse quickly; the stop-loss exists for that.

## 5. Screener score (used for ranking)

`scoreAt()` adds points; threshold used by auto trade is `SCORE_THRESHOLD = 10`
(maximum possible 15). Candidates are sorted by score, best first.

Positive: momentum 6-12% (+2) or 12-18% (+3); price > VWAP by 1%+ (+2); VWAP rising
(+1); turnover growing (+2); near day high (+1); turnover/market cap > 2% (+2);
market cap 1,500-15,000 Cr (+1); staircase of rising gains (+1); near upper
circuit 2-12% away (+1); early strength (+1).

Negative: stalled (-2); price < VWAP (-3); dropped from peak by 1+ point (-2);
thin liquidity (-1).

## 6. Order sizing and order type

- Quantity = `floor(AUTO_TRADE_CAPITAL / last price)` (default capital 1000 INR).
- Product: **MIS / intraday** (`product: I`), validity `DAY`, order type `MARKET`.
- Upstox appears to convert market orders into protected **limit** orders (seen in
  the order book on 2026-11-27: a MARKET BUY was stored as a LIMIT at about +1.5%).
  So fill prices can differ slightly from the recorded price.
- Entry price and quantity recorded in the DB come from the confirmed fill (see 6b).
  Exit prices are the price seen at exit time, not the real fill, so P&L is approximate.

## 6b. Entry fill check (live mode)

After a BUY is accepted, `confirmEntryFill()` polls the order status (up to 4 times,
1.5 s apart) through the relay:

| Result | What happens |
|---|---|
| `complete` | Trade becomes `OPEN` with the **actual filled quantity and average price** |
| `rejected` / `cancelled` (e.g. margin, not intraday-eligible) | Trade becomes `REJECTED` with Upstox's reason. No position is tracked and no SELL is ever sent |
| Still pending after polling | The order is cancelled; if nothing filled, the trade is `REJECTED` |
| Status cannot be read | Assumed filled, trade is `OPEN` with note `fill unconfirmed` (the order may really have filled) |

Exits (SELL) are not yet confirmed the same way.

## 7. Exit criteria

Checked on every run for each open trade (`runCycle`), first match wins:

| Reason | Rule | Default |
|---|---|---|
| `SQUAREOFF` | Time is 15:15 IST or later. All open trades are sold. | fixed |
| `STOP_LOSS` | Price <= entry price x (1 - SL%) | 5% below entry |
| `TARGET` | Price >= entry price x (1 + target%) | 3% above entry |

- If a SELL order fails, the trade stays `OPEN` and is retried on the next run.
- If the price cannot be fetched, the trade is held, except at square-off, which
  sells using the entry price as the fallback for P&L.
- Defaults mean risk is larger than reward (5% down vs 3% up), so the strategy
  needs a win rate above about 62% to break even before costs. Consider changing
  these.

## 8. Schedule

- `netlify/functions/trade-run.js`: cron `* 3-9 * * 1-5` (UTC), every minute on
  weekdays, about 08:30-15:29 IST. The cycle itself only acts during market hours.
- `netlify/functions/trending-refresh.js`: refreshes the gainers/losers snapshot.
- **Scheduled functions only run on the production deploy**, not on branch deploys
  such as `stage--...`.
- Every `trade-run` tick first calls `ensureFreshToken()` (see section 9), then
  `runCycle()`.

## 9. Upstox token (expires daily)

- Upstox access tokens expire at **03:30 IST every day**.
- `server/services/upstoxAuthService.js` logs in with TOTP + PIN and stores the new
  token in the database (`trade_settings`, key `upstox_access_token`).
- It runs **at most once per IST day**, only in **live** mode, and only if
  `UPSTOX_API_KEY`, `UPSTOX_PIN` and `UPSTOX_TOTP_SECRET` are all set.
  After a failure it retries at most every 10 minutes.
- A new login **revokes the previous token**.
- Manual fallback: paste a token on the Auto Trading page (`POST /api/trade-token`)
  or set `UPSTOX_ACCESS_TOKEN`.
- Open question: the TOTP login is called directly from Netlify, not through the
  relay. If Upstox enforces the static IP on login, it will fail from Netlify.

## 10. Static-IP relay

- Upstox requires a registered static IP for orders. Orders go through a small proxy
  on the Oracle VM (`129.154.252.253:3000`), pm2 process `upstox-relay`.
- Code: `relay/relay.js` in this repo. Live copy: `/home/ubuntu/relay.js` on the VM.
- Requests need header `x-secret` equal to `VM_RELAY_SECRET`.
- Routing: `/v3/order*` goes to `https://api-hft.upstox.com`, everything else to
  `https://api.upstox.com`.
- Update flow: edit `relay/relay.js`, `scp` it to the VM, then
  `pm2 restart upstox-relay`. If you change the secret, run
  `RELAY_SECRET=<new> pm2 restart upstox-relay --update-env && pm2 save`, and update
  `VM_RELAY_SECRET` in `.env` and Netlify. Do restarts outside market hours.

## 11. Modes and switches

| Setting | Effect |
|---|---|
| `AUTO_TRADE_ENABLED=true` | Required for the scheduled `trade-run` to do anything. `false` = it exits immediately. |
| `AUTO_TRADE_MODE=paper` (default) | Trades are recorded in the DB only. No broker call. |
| `AUTO_TRADE_MODE=live` | Real orders through the relay. Real money. |

Manual calls (header `x-admin-key: <TRADE_ADMIN_KEY>`):
`GET /api/trades` (status, config, trades, total P&L), `POST /api/trade-run`
(run one cycle now; note this places real orders in live mode, even if
`AUTO_TRADE_ENABLED` is false), `POST /api/trade-token` (store a token).

## 12. Environment variables

| Variable | Purpose | Default |
|---|---|---|
| `TRADE_ADMIN_KEY` | Protects `/api/trades`, `/api/trade-run`, `/api/trade-token` | none (endpoints return 503) |
| `VM_RELAY_URL` | Relay address | none |
| `VM_RELAY_SECRET` | Sent to the relay as `x-secret` | none |
| `RELAY_SECRET` | Used only by `relay/relay.js` on the VM. Must equal `VM_RELAY_SECRET` | none |
| `AUTO_TRADE_ENABLED` | Scheduler on/off | `false` |
| `AUTO_TRADE_MODE` | `paper` or `live` | `paper` |
| `AUTO_TRADE_CAPITAL` | INR per trade | `1000` |
| `AUTO_TRADE_MAX_POSITIONS` | Max trades per day (see section 2) | `3` |
| `AUTO_TRADE_SL_PERCENT` | Stop-loss % | `5` |
| `AUTO_TRADE_TARGET_PERCENT` | Target % | `3` |
| `AUTO_TRADE_STAGES` | Stages that trigger a buy | `IMMINENT,COILING` |
| `UPSTOX_API_KEY`, `UPSTOX_PIN`, `UPSTOX_TOTP_SECRET` | Daily token login | none |
| `DATABASE_URL` / `NETLIFY_DATABASE_URL` | Postgres for trades and token | none |

Local `.env` is not used by Netlify. Set the same values in the Netlify site settings.

## 13. Database

Table `trade_orders` (one row per trade; unique per `trade_date` + `symbol`):
status flow `PENDING` -> `OPEN` -> `CLOSED`, or `REJECTED` when the entry failed.
Stores entry/exit prices and order ids, stop-loss and target prices, exit reason,
P&L and the screener signal that triggered the trade.
Table `trade_settings` stores the Upstox token and refresh bookkeeping.

## 14. What has been tested (as of 2026-11-27)

- Entry, target, stop-loss, square-off and retry-on-failed-exit logic: simulated, passed.
- Relay reaches Upstox with a valid token; a real 1-share IDEA buy and sell filled
  (P&L about -0.01 INR).
- TOTP login from a local machine: worked.
- Not yet seen: a fully automatic signal-driven trade, and the TOTP login from Netlify.

## 15. Known risks and gotchas

- **Real money in live mode.** Start with a small `AUTO_TRADE_CAPITAL` and
  `AUTO_TRADE_MAX_POSITIONS=1`.
- Strategy chases stocks already up 12-17%; reversals are fast.
- Stop-loss (5%) is wider than target (3%).
- Stop-loss and target are checked by the cron roughly once a minute and are
  executed as market orders; they are not exchange-side bracket orders, so a fast
  move can gap past them.
- If the Netlify function or the VM relay is down, open trades are not managed and
  would remain open. Intraday (MIS) positions are auto squared off by the broker
  near close, possibly at a worse price.
- NSE's quote API moved the last price to `tradeInfo.lastPrice`; the code reads that
  first (fixed 2026-11-27, make sure it is deployed).
- Corporate VPN/proxy blocks NSE and the relay from a work machine. Test with the VPN off.
- Secrets (relay secret, admin key, API keys, PIN, TOTP secret) should be long,
  random and rotated; never commit `.env`.
