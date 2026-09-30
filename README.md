# Kate Ahead: see the bump before you hit it

Tectonic Hackathon, KBC challenge. A proof of concept for how KBC can understand what a customer needs **before they ask**. Kate looks 90 days ahead on the customer's account, spots the moments that will get tight, explains why, and offers a one-tap fix.

Every autumn the same surprises hit people: rent, the quarterly car insurance and the energy bill all land before payday, then the holidays arrive. The bank saw every one of those payments last year. Kate Ahead turns that history into a calm, early heads-up instead of an overdraft.

> Independent prototype, inspired by [KBC Touch](https://www.kbc.be/retail/en/products/payments/self-banking/on-your-pc/what-is-touch.html). **All people, balances and transactions are fictional.** Not affiliated with KBC.

## What it does

- **Early warning, in plain language.** A notification at the top of the Overview: *"Money gets tight 18–24 Oct: your rent, car insurance and energy bill go out before your salary on 25 Oct."* Spotted 18 days early.
- **One-tap fix.** *"Move €450 from savings on 17 Oct."* The server recalculates the forecast, the warning clears, and Kate moves on to the next one (the holidays in December).
- **Estimated balance chart.** An estimate for the next 90 days, with paydays, the lowest point and a comfort buffer marked. Hover for the details of any day.
- **Subscriptions and renewals.** Detects subscriptions, annual renewals and a free trial about to convert. Each has a "decide by" date and the payments that prove it. Keeping or stopping a subscription immediately changes the forecast.
- **Ask Kate.** Kate (an LLM through OpenRouter) gets the forecast summary, so she can answer "What's coming up?" or "Can I afford a weekend away?". **The engine calculates, Kate talks.** Kate never produces the numbers.

## How it works

```
data/expenses.json  ──►  src/detect.py (expense pattern engine)  ──►  output/insights_demo.json
  14 months of            recurring bills, salary, habits,              as of the demo date
  fictional payments      expensive periods (e.g. holidays)                    │
                                                                               ▼
public/ (KBC Touch-style UI)  ◄──  server.js  ◄──  forecast.js (90-day projection)  +  ahead.js (subscriptions)
```

- **`src/detect.py`**: explainable rules and statistics, with no model training. It finds subscriptions (cadence, price changes, cancellations), income, habits and expensive periods. Every insight comes with a `why`.
- **`forecast.js`**: builds the balance day by day for 90 days. It adds salary, recurring bills, trials and renewals, and repeating expensive periods, then subtracts everyday spending (the median of the last 6 months). It then finds the first tight period and its causes, safe-to-spend until payday, and one ready-made action.
- **`ahead.js`**: detects subscriptions and renewals in the account's payments and records keep/stop decisions.
- **`server.js`**: a zero-dependency Node server. It serves the UI and the APIs and proxies Kate to OpenRouter.

## Run locally

Requires Node.js 22+. No dependencies to install.

```sh
cp .env.example .env      # set OPENROUTER_KEY (only needed for the Kate chat)
npm start                 # http://localhost:4173
npm test                  # backend tests, no OpenRouter calls
```

Optional settings: `OPENROUTER_MODEL` and `PORT`. **Reset demo** (in the footer) restores the starting state.

To regenerate the engine output for the demo date (Python 3.10+, no packages needed):

```sh
python3 data/generate_expenses.py
python3 src/run.py --as-of 2026-09-30 data/expenses.json output/insights_demo.json
```

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/forecast` | 90-day forecast: `days[]`, `risk`, `safeToSpend`, `events[]`, `actions[]` |
| POST | `/api/forecast/action` | `{ "id": "bridge", "apply": true \| false }`. The server works out the amount and date itself |
| GET | `/api/ahead` | Detected subscriptions, renewals and trials |
| POST | `/api/ahead/decision` | `{ subscriptionId, action }`: keep, stop, confirm or dismiss |
| POST | `/api/ahead/reset` | Reset the demo state |
| POST | `/api/chat` | Kate chat through OpenRouter, with the forecast summary as data |

Contract for the subscription API: `docs/kate-ahead.schema.json`.

## Security notes

- The API key stays on the server (`.env` is git-ignored). The browser never talks to OpenRouter directly.
- The server accepts requests only on localhost, and state-changing requests only from the same origin (checked with the `Origin` and `Sec-Fetch-Site` headers).
- The browser never supplies amounts or dates for actions. The server recomputes them from its own forecast.
- Input limits and validation apply to chat messages and context. LLM output is rendered as text, never as HTML. There's a limit on concurrent Kate requests.

## Scaling to KBC's 2.3M+ customers

The forecast is a small pure function per customer. It only needs recomputing when that customer's payments change, and it parallelises by customer id. The LLM is only called when a customer asks Kate something, never in the batch. New signals (loan end dates, insurance renewals, deposits maturing) plug in as new event sources, and the same notifications and actions pick them up.

## Unfinished / known limitations

- One demo customer. The engine's payment history (salary from "Brightline NV") comes from a different fictional customer than the account page (Alex).
- No login. This is a single-user local demo.
- "Remind me" and "Not now" only show a confirmation message. Transfers and stop requests change demo state only. Nothing touches a real bank or merchant.
- Forecasts are estimates from past patterns and are labelled as such in the UI.
