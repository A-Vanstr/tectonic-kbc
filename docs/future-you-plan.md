# Future You: implementation, branding and demo plan

Status: draft, 30 September 2026. It builds on Codex's KBC Touch mockup in `../kbc-mockup/dist`.

---

## 1. Positioning: why this isn't "just a forecast"

KBC already has pieces of this: Kate sends upcoming-payment and low-balance reminders, and business customers get a 90-day cash-flow forecast in Business Dashboard. So "a balance chart for the next 90 days" is **not** our pitch. Our pitch is the combination:

| KBC today | Future You adds |
|---|---|
| Reminds you about *known* scheduled payments | Predicts the payments nobody has scheduled: annual bills, the energy settlement, the tax bill, renewals |
| Alerts when the balance is *already* low | Warns **weeks in advance** and shows the cause |
| Alerts | **Ready-made actions**: one tap and the dip is gone |
| Business-only forecasting | Consumer forecasting built around the **Belgian money calendar** |
| Precise-looking numbers | **Honest uncertainty** (a range, not one line) plus "why we think this", with the evidence |
| — | **"Can I afford it?"**: ask Kate a what-if and see your future change |

**Problem statement** (the frustration everyone has accepted): *every autumn, Belgians get hit by the same surprises: the energy settlement, the tax bill, annual renewals. The bank saw every one of them coming last year.*

---

## 2. Branding

**Product name: "Kate Ahead"**. Kate is already KBC's assistant, and "Ahead" is what's new: Kate looks ahead for you. We use "Future You" only as the pitch/concept name.
Alternatives if the team doesn't like it: *Vooruitblik* (Dutch for "look ahead", very Belgian), *Next 90*, *Money Forecast*.

**Visual metaphor: a money weather forecast.** Everyone already understands forecasts with uncertainty ("70% chance of rain"). That makes the uncertainty band feel natural instead of like a disclaimer.
- Each week gets a weather icon: ☀️ comfortable · ⛅ tight · ⛈️ likely shortfall.
- The timeline chart = the "forecast": an expected balance line with a shaded range (the 10th–90th percentile band).
- Copy tone: calm and specific, never alarming. "Late November looks tight. Here's why, and here's a fix."

**Taglines** (pick one):
- "See the bump before you hit it."
- "Your next 90 days, sorted."
- "Kate saw it coming. Now you do too."

**Visual identity:** reuse the mockup's tokens (`--blue:#007ab8`, `--dark:#004b77`, `--muted`, `--line`). Add one accent for the forecast: amber for "tight" and red for "shortfall", used sparingly. Kate's symbol `✦` marks everything Kate Ahead does.

**Link to KBC's own motto ("save time, earn money"):** every resolved issue shows *what it avoided* (the overdraft cost, the stress, the phone call). No invented "minutes saved" numbers.

---

## 3. How it fits into Codex's mockup

The mockup is a vanilla-JS KBC Touch clone: hash navigation, in-memory fixtures in `data.js`, a deterministic Kate panel in `app.js`, persona **Alex Vermeulen**, "today" = **30 Sep 2026**. We **reuse Alex and the fixed date**, so Future You looks like a native KBC feature rather than a separate app.

Five touchpoints, from most to least important:

| # | Where | What |
|---|---|---|
| 1 | **New nav item "Kate Ahead"** (between Payments and Cards) | The full page: forecast chart, week weather strip, upcoming predicted events, ready-made actions |
| 2 | **Overview page card** | "Next 90 days: ⛅ late November looks tight" + safe-to-spend today + link to the page |
| 3 | **Notification bell** | The single proactive alert, sent 7 weeks early ("Heads up for 21–28 Nov") |
| 4 | **Kate panel** | New suggestion chips: "What's coming up?", "Can I afford…?". Free-text questions go to our backend |
| 5 | **Payments → Scheduled** | Predicted payments shown next to the real scheduled ones, clearly labelled "predicted" |

**Integration rules, so we don't collide with Codex:**
- Our UI lives in separate files: `future.js` (page + overview card), `future.css`, `api.js`. We only touch `app.js` at 4 small hooks: the `nav` array, the `render()` route switch, a slot on the overview page, and a fallback in `ask()` to our API.
- Ask Codex (or wait until it's done) to expose those hooks cleanly: e.g. `registerView(id, label, icon, renderFn)`, an `#overview-slots` container, and an `onUnknownQuestion(q)` callback.
- Move the mockup into this repo as `web/` and serve it from our backend, so it's one origin and there are no CORS or API keys in the browser.

---

## 4. Architecture

```
web/ (Codex's mockup + future.js) ──fetch──▶ server/ (Node + Express)
                                              ├─ auth (session cookie, demo personas)
                                              ├─ engine/  ← deterministic, no LLM
                                              │   recurrence.js   detect subscriptions, salary, renewals
                                              │   calendar-be.js  Belgian money calendar rules
                                              │   forecast.js     day-by-day projection + P10/P90 band
                                              │   risks.js        shortfall windows + causes
                                              │   actions.js      ready-made fixes (preview → apply)
                                              │   scenario.js     what-if diffs
                                              ├─ kate/  ← OpenRouter LLM: parses questions, phrases answers
                                              └─ data/  seeded synthetic history generator + personas
```

**Stack choice:** Node + Express. It's the same language as the mockup and one process that serves the static `web/` too, which deploys easily to Cloud Run (GCP credits). If the team is stronger in Python, FastAPI works just as well. Decide once and move on.

**Core principle:** ***the engine calculates, Kate talks.*** The LLM never produces a number. It turns free text into a validated scenario, and turns engine output into a friendly sentence. That's our trust story *and* our security story (no hallucinated balances).

---

## 5. The engine, piece by piece

### 5.1 Synthetic history (build this first)
- A seeded generator produces **18 months** of transactions for Alex that extend the mockup's fixtures (Delhaize, NMBS, Studio North salary, Spotify, Luminus, Telenet, rent on the joint account…).
- The data is **story-driven but real**: we plant last year's events (energy settlement, tax bill, annual renewals), and the engine has to *detect* them. No hard-coded predictions.
- Add 2 extra personas to prove it adapts: **Noor** (student, irregular income from a student job) and **the Peeters family** (homeowners with kids, so property tax and September school costs apply).

### 5.2 Recurrence detection (subscriptions and renewals, feature 1)
- Normalize the counterparty (e.g. "DISNEY PLUS 1234" → `disney+`) with rules first and the LLM as an optional fallback, cached.
- Group by counterparty + amount band, then classify the period (weekly, monthly, quarterly, annual) from the median gap between payments and how regular it is.
- Output per series: next expected date, amount range, confidence, **evidence** (the past transaction ids), and for annual series a **"decide by" date** (the charge date minus the notice period, confirmed by the customer, or a default of 14 days).
- Extras that are cheap once series exist: **price increase detected**, **free trial converting** (a €0/€1 charge followed by nothing yet), **overlap** (two streaming services).

### 5.3 Belgian money calendar
Rules triggered by history plus persona attributes. Each rule has an evidence link:

| Event | Trigger | Typical timing |
|---|---|---|
| Energy annual settlement (*jaarafrekening*) | last year's settlement from the energy provider + usage trend | same month as last year |
| Personal income tax (*aanslagbiljet*) | last year's payment/refund to FOD Financiën | due ~2 months after the tax notice (autumn) |
| Property tax (*onroerende voorheffing*) | homeowner + last year's payment | the month it arrived last year |
| Holiday pay (*vakantiegeld*) | an extra salary-like income in May/June last year | May/June |
| Year-end bonus (*eindejaarspremie*) | an extra salary-like income in December last year | December |
| School costs | income from the Groeipakket (child benefit) | late August / September |
| Annual insurance premiums | annual payments to insurers | anniversary date |

### 5.4 Forecast (feature 2)
- Day by day for 90 days: `balance(t) = start + scheduled (certain) + recurring (probable) + calendar events (estimated) − everyday spending`.
- Everyday spending: the daily distribution per category from the last 6 months. Sample it (Monte Carlo, ~500 runs, fast) or use percentiles → an **expected line + P10/P90 band**.
- **Risk windows:** runs of days where P10 < 0 (or below the customer's chosen buffer), with the **causing events** ranked by contribution.
- **Safe-to-spend today** = the lowest P10 balance before the next salary, minus the buffer.

### 5.5 Ready-made actions (the "wow" of the demo)
Each action = `preview()` → a forecast diff (the chart redraws with a dashed "after" line) → `apply()` → state change → recompute.
- **Bridge from savings:** move €X from savings on the day before the dip, with an optional automatic move back after the year-end bonus.
- **Smooth the bump:** a monthly set-aside into a named savings pot until the event date.
- **Shift a standing order** after payday (only flexible ones, like the savings transfer, never external direct debits).
- **Raise the energy advance** by €Y/month so next year's settlement is ~€0.
- **Review a renewal** before its "decide by" date: keep / cancel reminder / already cancelled.

### 5.6 "Can I afford it?" (Kate what-if)
1. The user asks: *"Can I afford a €1,200 ski trip after Christmas?"*
2. The LLM (via OpenRouter) turns it into strict JSON: `{type:"one_off", amount:1200, date:"2026-12-27", label:"Ski trip"}`, validated with a schema. If validation fails → Kate asks a follow-up question.
3. The engine computes the baseline vs the scenario.
4. The LLM phrases the answer **only from the engine's facts**: "Yes, thanks to your year-end bonus on 18 Dec. But don't pay the deposit before 28 Nov: that week is already tight."
5. The UI shows the scenario line on the same chart.

### 5.7 Corrections (trust)
Every predicted event has **✓ Correct / ✎ Edit amount or date / ✕ Not happening**. A correction immediately recomputes the forecast and is stored as feedback for that series.

---

## 6. API (all scoped to the logged-in customer)

```
POST /api/login                     demo persona picker → httpOnly session cookie
GET  /api/forecast?days=90          { today, days:[{date,expected,p10,p90}], weeks:[{start,weather}],
                                      events:[…], risks:[…], safeToSpend }
GET  /api/events/:id                event + evidence transactions
POST /api/events/:id/correction     { status | amount | date }
POST /api/actions/:id/preview       forecast diff
POST /api/actions/:id/apply         idempotent, rechecked on the server
POST /api/kate                      { message } → { text, scenario?, forecastDiff? }
GET  /api/admin/scale               admin role only: stored results from the benchmark run
```

**Freeze these JSON shapes in hour 1** and put a mock JSON file in `web/`, so the frontend and engine can be built in parallel.

---

## 7. Security (the Aikido 10%, and it's easy points)

- **No IDOR:** the customer id always comes from the session, never from the URL or request body. Event and action ids are looked up *within* that customer's data. Test: Alex's session requesting Noor's event → 404.
- **Business logic:** a bridge amount can't exceed the savings balance; dates can't be in the past; `apply` is idempotent and recomputes on the server (it never trusts a client preview); only flexible standing orders can be shifted.
- **Authz:** `/api/admin/*` requires the admin role.
- **LLM safety:** the OpenRouter key is only on the server (`.env`, already gitignored); LLM output is schema-validated JSON and rendered as text (`textContent`), never HTML; `/api/kate` is rate-limited; the system prompt is fixed, and user text is passed only as data.
- **Generic:** helmet/CSP, session cookies `httpOnly` + `SameSite=Lax`, input validation (zod) on every endpoint, no secrets in the repo.
- Run the Aikido baseline **as soon as auth and the API exist** (the "before" screenshot), then fix and take the "after" screenshot.

---

## 8. Scale story (measured, not invented)

- `scripts/scale-bench.js`: generate **N synthetic customers** (e.g. 100k) and run the full engine, timing it on one Cloud Run instance / laptop. Report customers/second and extrapolate to 2.3M, **labelled as a synthetic benchmark**.
- **Why it scales:** the forecast is recomputed only when a customer's data changes (a new transaction or event), not daily for everyone; the engine is pure functions per customer, so it parallelizes by customer id; the LLM runs only when the customer asks Kate something, never in the batch.
- **Bank-side view** (the `/api/admin/scale` page): from the benchmark population, the predicted shortfalls per week and the **top causes** (e.g. "energy settlements drive most of November's shortfalls"). That's an insight KBC can act on proactively (e.g. suggest higher energy advances in September).
- **It extends across products:** the same event model covers insurance renewals, loans ending (money freed up), deposits maturing, mortgage rate reviews. Adding a new product = a new event source, not new UI.

---

## 9. Demo: one customer, one story (≤ 2:50)

**Fixed "today": Tuesday 30 September 2026. Alex was paid €2,850 yesterday. Balance €2,846. Everything looks fine.**

What the engine finds in the next 90 days:
- **12 Nov**: energy settlement from Luminus ≈ **€420** (€340–€510). Evidence: last November's settlement of €380, and usage up ~10%.
- **18 Nov**: Disney+ annual renewal **€89.90**, decide by 11 Nov.
- **20 Nov**: income tax bill ≈ **€640**. Evidence: last year's tax payment and the side income from freelance work.
- **21–27 Nov**: ⛈️ likely shortfall, down to **−€310** (range −€520 to −€90) until the salary on 27 Nov.
- **18 Dec**: year-end bonus **+€2,400**.

| Time | Screen | Beat |
|---|---|---|
| 0:00–0:20 | Title card | The hook: "Every autumn, the same surprises. The bank saw them coming last year." |
| 0:20–0:40 | KBC Touch overview | Everything looks fine… but the Kate Ahead card says ⛅ *late November looks tight*. The bell shows one alert, 7 weeks early. |
| 0:40–1:15 | Kate Ahead page | Weather strip, the chart with its range, the dip. Tap the energy settlement → **"why we think this"**, with last year's transaction. |
| 1:15–1:40 | Action | "Bridge €400 from savings on 19 Nov, return it after your year-end bonus" → preview (dashed line) → **apply → the storm turns to sun.** |
| 1:40–1:55 | Correction | "I already cancelled Disney+" → ✕ → the forecast updates instantly. |
| 1:55–2:20 | Kate | "Can I afford a €1,200 ski trip after Christmas?" → yes, with a scenario line and a timing tip. |
| 2:20–2:40 | Bank console | Measured benchmark, top shortfall causes across the population, extensibility (renewals, loans, deposits). |
| 2:40–2:50 | Close | Trust + security (estimates are labelled, the customer confirms, the engine calculates and Kate talks; Aikido before/after). "Kate saw it coming. Now Alex does too." |

**Backup plan:** record the demo from a seeded, deterministic state (the `Reset demo` button already exists). If the LLM is slow or down, Kate falls back to a pre-parsed scenario for the scripted question.

---

## 10. Team split and timeline (assumes ~24h and 4 people; adjust)

| Person | Owns |
|---|---|
| A | Generator + recurrence + calendar + forecast engine + unit tests |
| B | Express server, auth, API, security, Aikido, deployment |
| C | `future.js` UI inside the mockup: chart, weather strip, events, actions, corrections |
| D | Kate/OpenRouter integration, scale benchmark + console, demo script, video, README |

| Hours | Milestone |
|---|---|
| 0–2 | Freeze Alex's story and numbers (section 9), freeze the API JSON, create the mock JSON, move the mockup into `web/` |
| 2–10 | Build in parallel against the mock JSON |
| 10–12 | Integrate: real engine behind the real API behind the real UI |
| 12 | **Aikido baseline scan** |
| 12–18 | Actions, what-if, corrections, benchmark, extra personas; Aikido fixes |
| 18 | **Feature freeze.** Only bug fixes and polish after this |
| 18–22 | Record the video, README, Aikido "after" screenshot |
| 22+ | Submit on Builderbase (then it's final) |

**Cut order if time runs out** (drop from the bottom first): extra personas → bank console (keep the benchmark number) → price-increase/free-trial extras → corrections → Kate what-if. **Never cut:** the forecast + evidence + one action that removes the dip.

---

## 11. Open questions

1. Hackathon duration and team size? (The timeline above assumes ~24h and 4 people.)
2. Node or Python for the backend?
3. Can Codex expose the 4 integration hooks, or do we take over the mockup when it's done?
4. Mentor check: does Kate already warn *weeks ahead* about predicted (unscheduled) payments like the energy settlement or tax bill? If yes, we lead with what-if + actions.
