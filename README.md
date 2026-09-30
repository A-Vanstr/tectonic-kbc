# KBC expense pattern engine (hackathon)

Learns a customer's spending patterns from their transaction history, then predicts from "today":

- **Subscriptions and recurring bills**: cadence, price, next charge, price hikes, cancelled subscriptions
- **Habits**: regular merchants, weekday patterns, seasonal categories, spending after payday
- **Expensive periods**: weeks that are clearly above normal and what drove them
- **Forecast**: this month so far compared with normal, an end-of-month projection, and a warning before the next expensive period
- **Changes**: new subscriptions, price changes, cancellations, and habits that shifted recently
- **Feed**: ready-to-show cards for the app, most important first

Everything is explainable rules and statistics (no model training), so every insight comes with a `why` or `message`.

## Run it

Python 3.10+ only, no packages to install.

```bash
python data/generate_expenses.py   # writes data/expenses.json and data/expenses.csv
python src/run.py                  # writes output/insights.json and prints a summary
```

"Today" defaults to the last transaction date. To predict from another day, pass `--as-of`. The engine then ignores everything after that date:

```bash
python src/run.py --as-of 2026-06-15 data/expenses.json output/insights_june.json
```

## Demo data

The demo data is seeded, so it's identical every run. It runs from **1 October 2025 to 20 November 2026**. The last day is the demo "today", 18 days before the December gift period starts.

The persona is Lotte, 34, from Leuven, who has one child. Her data includes:

- **Recurring bills and subscriptions**: rent, Engie, Telenet, Orange, and quarterly water and car insurance. Subscriptions are Netflix (price hike in February 2026), Spotify, iCloud, Basic-Fit (billed every 4 weeks), and Disney+, which she cancelled in March 2026.
- **Habits**: Colruyt on Tuesdays and Saturdays, Delhaize on Thursdays, the bakery at the weekend, coffee on workdays, dinners out on Fridays and Saturdays, fuel every 9 to 15 days, and more shopping after payday.
- **Expensive periods**: Christmas gifts (December 2025), a July holiday in Spain, and back to school. There are also one-offs: a car repair, a laptop and the dentist.
- **Changes in the second year** that the engine should notice: ChatGPT Plus starts in August 2026, Spotify goes from €11.99 to €12.99 in September 2026, and she eats out more often from mid-September 2026.

## Input format

A JSON array of transactions. Spend is negative, income is positive:

```json
{ "id": "tx_00001", "date": "2025-10-01", "amount": -975.0,
  "merchant": "Immo Verhuur Leuven", "category": "housing", "channel": "standing_order" }
```

`channel` is one of `card`, `direct_debit`, `standing_order`, or `transfer`. Income transactions should use category `income`, because the payday habit relies on it.

## Output: `output/insights.json`

All amounts are **positive euros**.

| Key | What it contains |
| --- | --- |
| `summary` | totals, average complete month, recurring and subscription cost per month, top 5 categories |
| `feed[]` | cards to show on the home screen: `priority` (1 is most important), `type`, `title`, `message` |
| `forecast` | the current month and the upcoming expensive periods (see below) |
| `changes` | `new_subscriptions`, `price_changes`, `cancelled`, `habit_shifts`, each with a `message` |
| `subscriptions[]` | one entry per detected recurring charge |
| `upcoming_charges[]` | active recurring charges expected in the next 30 days |
| `income_streams[]` | recurring income such as salary, with the next expected date |
| `habits[]` | detected habits, each with a ready-to-show `title` and `description` |
| `expensive_periods[]` | flagged periods in the history, with drivers |
| `monthly_spend[]` | per month: `total`, `recurring`, `discretionary`, `income`, `complete` (false for the current month) |
| `meta` | generation time and a short description of each method |

### `feed[]` card types

- `upcoming_expensive_period`: "Coming up: holiday season and gifts".
- `month_pace`: shown only when this month is more than 10% above or below normal.
- `new_subscription`
- `habit_shift`
- `price_change`
- `month_forecast`

### `forecast`

- `month_to_date`: `spent`, `typical_by_today`, `difference`, `difference_pct`, `status` (`above`, `on_track` or `below`), `income`, `message`.
- `end_of_month`: `projected_spend`, `typical_month_spend`, `remaining_recurring[]`, `remaining_discretionary_estimate`, `remaining_income[]`, `projected_income`, `projected_net`, `message`.
- `daily[]`: one point per day of the month, `{day, date, actual, typical, projected}`. `actual` is `null` after today and `projected` is `null` before today, so you can draw three lines on one chart.
- `upcoming_periods[]`: `title`, `expected_start`, `days_until`, `alert` (true within 45 days), `last_time` (what it cost and which merchants drove it), `suggested_weekly_saving`, `message`.

### `subscriptions[]`

`merchant`, `category`, `kind` (`subscription` or `recurring_bill`), `status` (`active` or `cancelled`), `cadence` (`weekly`, `biweekly`, `four_weekly`, `monthly`, `quarterly`, `yearly`), `amount` (current price), `monthly_cost`, `yearly_cost`, `charges`, `total_paid`, `first_charge`, `last_charge`, `next_expected_date`, `price_change` (`null` or `{from, to, date, change_pct}`), `confidence` (0 to 1), `why`, `transaction_ids`.

### `habits[]`

`id`, `type`, `title`, `description`, `category`, `merchant`, `stats`. The `type` values are:

- `merchant_frequency`: "Regular at Colruyt Leuven". The `stats` include visits per week, average amount, monthly spend and weekday pattern.
- `weekday`: "Dining mostly on Friday and Saturday". The `stats` include the weekdays, share, and lift compared with an even spread over the week.
- `seasonal_category`: "Shopping peaks in December". The `stats` include the peak months, the typical month, and the ratio between them.
- `payday`: "You spend more right after payday". The `stats` include the average daily spend after payday compared with other days.

### `expensive_periods[]`

`id`, `kind`, `title`, `start`, `end`, `weeks`, `spent`, `baseline`, `extra_spend`, `ratio_vs_baseline`, `top_categories`, `top_merchants` (sorted by extra spend compared with that merchant's normal), `largest_transaction`, `why`, `next_occurrence`.

`kind` is one of `holiday_season`, `summer_holiday`, `back_to_school`, `one_off`, or `spending_spike`. For the three yearly kinds, `next_occurrence` is `{expected_start, days_until, months_until, suggested_monthly_saving}`. For the others it is `null`.

## How the algorithm works

All code lives in [`src/detect.py`](src/detect.py). Thresholds are constants at the top of the file.

1. **Subscriptions.** Spend is grouped by normalized merchant name. A group counts as recurring when the median gap between charges matches a known cadence and at least 80% of gaps are on schedule. The amount must also stay within 5% between at least 75% of consecutive charges, so a price hike is allowed. A charge that is overdue by more than 1.5 cycles marks the subscription as `cancelled`. Recurring income is detected the same way.
2. **Habits.** These are computed on the remaining non-recurring spend:
   - Weekday concentration, compared with an even spread over the week.
   - Merchants visited at least 20 times.
   - Category months that reach at least 2x a normal month. A month isn't counted when a single purchase makes up most of it.
   - Daily spend in the 6 days after salary, compared with other days.
3. **Expensive periods.** Each week's non-recurring spend is compared with the median of the 4 weeks before and after it. A week at 1.7x or more and at least €150 above that median starts a period. Neighbouring weeks at 1.4x or more and at least €100 above the median extend it. Each period is then labelled from its calendar months and its top spending drivers.
4. **Forecast.**
   - **Month so far:** spend up to today, compared with the median of all earlier complete months up to the same day.
   - **End of month:** spent so far, plus the recurring charges still scheduled, plus the typical non-recurring spend for the remaining days.
   - **Expected income:** the salary still to come this month.
   - **Warnings:** yearly expensive periods are projected to the same dates next year, with a warning 45 days in advance.
5. **Changes.**
   - Recurring charges that started in the last 120 days.
   - Price changes in the last 180 days.
   - Cancellations in the last year.
   - Categories whose last 8 weeks differ by at least 30% and at least €40 a month from the long-run average, with at least 8 payments. Expensive periods are left out of the long-run average.
