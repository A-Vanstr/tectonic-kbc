"""Explainable expense pattern engine: subscriptions, habits and expensive periods.

Input: a list of transactions {id, date, amount, merchant, category, channel}
with negative amounts for spend. All returned amounts are positive euros.
"""

import calendar
import re
import statistics
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta, timezone

WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
MONTHS = [None, "January", "February", "March", "April", "May", "June", "July",
          "August", "September", "October", "November", "December"]

# name, period in days, tolerance in days, minimum charges needed
CADENCES = [
    ("weekly", 7.0, 1.0, 8),
    ("biweekly", 14.0, 2.0, 5),
    ("four_weekly", 28.0, 1.5, 4),
    ("monthly", 30.44, 3.5, 4),
    ("quarterly", 91.3, 10.0, 3),
    ("yearly", 365.25, 20.0, 2),
]
SUBSCRIPTION_CATEGORIES = {"subscriptions"}

MIN_GAP_REGULARITY = 0.8
MIN_AMOUNT_STABILITY = 0.75
PRICE_STEP_TOLERANCE = 0.05

HABIT_MIN_CATEGORY_TX = 20
HABIT_MIN_MERCHANT_TX = 20
HABIT_TOP_MERCHANTS = 5
SEASONAL_MIN_CATEGORY_TOTAL = 300
SEASONAL_MIN_MONTH_TOTAL = 150
SEASONAL_RATIO = 2.0
ONE_OFF_SHARE = 0.6
PAYDAY_WINDOW_DAYS = 6
PAYDAY_MIN_RATIO = 1.15

PERIOD_WINDOW_WEEKS = 4
PERIOD_MIN_RATIO = 1.7
PERIOD_MIN_EXTRA = 150
PERIOD_EXTEND_RATIO = 1.4
PERIOD_EXTEND_EXTRA = 100
YEARLY_PERIOD_KINDS = ("summer_holiday", "holiday_season", "back_to_school")

PACE_TOLERANCE_PCT = 10
UPCOMING_ALERT_DAYS = 45

NEW_SUBSCRIPTION_DAYS = 120
NEW_SUBSCRIPTION_MIN_HISTORY_DAYS = 60
RECENT_PRICE_CHANGE_DAYS = 180
RECENT_CANCELLATION_DAYS = 365
SHIFT_RECENT_DAYS = 56
SHIFT_MIN_HISTORY_DAYS = 180
SHIFT_MIN_CATEGORY_TOTAL = 300
SHIFT_MIN_CHANGE_PCT = 30
SHIFT_MIN_MONTHLY_DELTA = 40
SHIFT_MIN_PAYMENTS = 8

CADENCE_DAYS = {name: days for name, days, _, _ in CADENCES}


# ---------------------------------------------------------------- helpers

def _r(x):
    return round(float(x), 2)


def normalize_merchant(name):
    s = name.lower()
    s = re.sub(r"[\d*#]+", " ", s)
    s = re.sub(r"[^a-z&+ ]", " ", s)
    return " ".join(s.split())


def add_months(d, n):
    month = d.month - 1 + n
    year = d.year + month // 12
    month = month % 12 + 1
    return date(year, month, min(d.day, calendar.monthrange(year, month)[1]))


def month_key(d):
    return f"{d.year:04d}-{d.month:02d}"


def iter_months(start, end):
    d = date(start.year, start.month, 1)
    while d <= end:
        yield d
        d = add_months(d, 1)


def weekday_counts(start, end):
    counts = Counter()
    d = start
    while d <= end:
        counts[d.weekday()] += 1
        d += timedelta(days=1)
    return counts


def fmt_day(d, year=False):
    return f"{d.day} {MONTHS[d.month]}" + (f" {d.year}" if year else "")


def join_days(days):
    names = [WEEKDAYS[w] for w in days]
    return names[0] if len(names) == 1 else ", ".join(names[:-1]) + " and " + names[-1]


def parse(transactions):
    txs = []
    for t in transactions:
        t = dict(t)
        t["date"] = date.fromisoformat(t["date"])
        t["key"] = normalize_merchant(t["merchant"])
        txs.append(t)
    txs.sort(key=lambda t: t["date"])
    return txs


# ---------------------------------------------------------------- subscriptions

def _match_cadence(gaps):
    median_gap = statistics.median(gaps)
    name, days, tol, min_count = min(CADENCES, key=lambda c: abs(c[1] - median_gap))
    if abs(days - median_gap) > tol:
        return None
    regularity = sum(abs(g - days) <= tol for g in gaps) / len(gaps)
    return name, days, tol, min_count, regularity


def _amount_stability(amounts):
    """Share of consecutive charges whose price stayed (nearly) the same.

    Measured pairwise so a single price hike does not break detection.
    """
    pairs = list(zip(amounts, amounts[1:]))
    if not pairs:
        return 1.0
    return sum(abs(b - a) / a <= PRICE_STEP_TOLERANCE for a, b in pairs) / len(pairs)


def _price_change(group):
    last_change = None
    for prev, cur in zip(group, group[1:]):
        a, b = -prev["amount"], -cur["amount"]
        if abs(b - a) / a > 0.02:
            last_change = (a, b, cur["date"])
    if not last_change:
        return None
    a, b, when = last_change
    return {
        "from": _r(a),
        "to": _r(b),
        "date": when.isoformat(),
        "change_pct": _r((b - a) / a * 100),
    }


def _next_date(last, cadence_name, cadence_days):
    if cadence_name == "monthly":
        return add_months(last, 1)
    if cadence_name == "quarterly":
        return add_months(last, 3)
    if cadence_name == "yearly":
        return add_months(last, 12)
    return last + timedelta(days=round(cadence_days))


def detect_subscriptions(txs, as_of):
    by_merchant = defaultdict(list)
    for t in txs:
        if t["amount"] < 0:
            by_merchant[t["key"]].append(t)

    found = []
    for key, group in by_merchant.items():
        if len(group) < 2:
            continue
        dates = [t["date"] for t in group]
        gaps = [(b - a).days for a, b in zip(dates, dates[1:])]
        match = _match_cadence(gaps)
        if not match:
            continue
        cadence_name, cadence_days, tol, min_count, regularity = match
        amounts = [-t["amount"] for t in group]
        stability = _amount_stability(amounts)
        if (len(group) < min_count or regularity < MIN_GAP_REGULARITY
                or stability < MIN_AMOUNT_STABILITY):
            continue

        last = group[-1]
        current_amount = -last["amount"]
        days_since_last = (as_of - last["date"]).days
        active = days_since_last <= cadence_days * 1.5 + tol
        count_score = min(1.0, len(group) / (min_count * 2))
        confidence = 0.45 * regularity + 0.35 * stability + 0.2 * count_score
        category = Counter(t["category"] for t in group).most_common(1)[0][0]
        name = Counter(t["merchant"] for t in group).most_common(1)[0][0]
        monthly_cost = current_amount * 30.44 / cadence_days

        found.append({
            "merchant": name,
            "category": category,
            "kind": "subscription" if category in SUBSCRIPTION_CATEGORIES else "recurring_bill",
            "status": "active" if active else "cancelled",
            "cadence": cadence_name,
            "interval_days": _r(statistics.median(gaps)),
            "amount": _r(current_amount),
            "monthly_cost": _r(monthly_cost) if active else 0.0,
            "yearly_cost": _r(monthly_cost * 12) if active else 0.0,
            "charges": len(group),
            "total_paid": _r(sum(amounts)),
            "first_charge": group[0]["date"].isoformat(),
            "last_charge": last["date"].isoformat(),
            "next_expected_date": (
                _next_date(last["date"], cadence_name, cadence_days).isoformat() if active else None
            ),
            "price_change": _price_change(group),
            "confidence": _r(confidence),
            "why": (
                f"{len(group)} charges about every {statistics.median(gaps):g} days "
                f"({int(regularity * 100)}% on schedule), amount stable in "
                f"{int(stability * 100)}% of consecutive charges"
                + ("" if active else f"; no charge for {days_since_last} days")
            ),
            "transaction_ids": [t["id"] for t in group],
        })

    found.sort(key=lambda s: (s["status"] != "active", -s["monthly_cost"], s["merchant"]))
    return found


# ---------------------------------------------------------------- habits

def _weekday_pattern(dates, day_totals):
    """Find the strongest set of weekdays these dates concentrate on, if any."""
    n = len(dates)
    counts = Counter(d.weekday() for d in dates)
    total_days = sum(day_totals.values())
    expected = {w: day_totals[w] / total_days for w in range(7)}
    lift = {w: (counts[w] / n) / expected[w] for w in range(7)}

    candidates = []
    peak = []
    for w in sorted(range(7), key=lambda w: lift[w], reverse=True)[:3]:
        if lift[w] < 1.5:
            break
        peak.append(w)
        if sum(counts[x] for x in peak) / n >= 0.6:
            break
    if peak:
        candidates.append(("days", sorted(peak)))
    candidates.append(("workdays", [0, 1, 2, 3, 4]))
    candidates.append(("weekend", [5, 6]))

    best = None
    for label, days in candidates:
        share = sum(counts[w] for w in days) / n
        set_lift = share / sum(expected[w] for w in days)
        if share >= 0.6 and set_lift >= 1.3 and (best is None or set_lift > best["lift"]):
            best = {"label": label, "days": days, "share": share, "lift": set_lift}
    if not best:
        return None
    if best["label"] == "workdays":
        when = "on workdays"
    elif best["label"] == "weekend":
        when = "in the weekend"
    else:
        when = "on " + join_days(best["days"])
    return {
        "when": when,
        "weekdays": [WEEKDAYS[w] for w in best["days"]],
        "share_pct": _r(best["share"] * 100),
        "lift": _r(best["lift"]),
    }


def _weekday_habits(spend, day_totals):
    by_cat = defaultdict(list)
    for t in spend:
        by_cat[t["category"]].append(t)
    habits = []
    for category, group in sorted(by_cat.items()):
        if len(group) < HABIT_MIN_CATEGORY_TX:
            continue
        pattern = _weekday_pattern([t["date"] for t in group], day_totals)
        if not pattern:
            continue
        habits.append({
            "type": "weekday",
            "title": f"{category.capitalize()} mostly {pattern['when']}",
            "description": (
                f"{pattern['share_pct']:g}% of your {category} payments happen {pattern['when']}, "
                f"{pattern['lift']:g}x more than if they were spread evenly over the week."
            ),
            "category": category,
            "merchant": None,
            "stats": {**pattern, "transactions": len(group)},
        })
    habits.sort(key=lambda h: -h["stats"]["lift"])
    return habits


def _merchant_habits(spend, day_totals, start, end):
    weeks = max(1.0, ((end - start).days + 1) / 7)
    months = weeks / (52 / 12)
    by_merchant = defaultdict(list)
    for t in spend:
        by_merchant[t["key"]].append(t)

    habits = []
    for group in by_merchant.values():
        if len(group) < HABIT_MIN_MERCHANT_TX:
            continue
        amounts = [-t["amount"] for t in group]
        total = sum(amounts)
        name = Counter(t["merchant"] for t in group).most_common(1)[0][0]
        per_week = len(group) / weeks
        pattern = _weekday_pattern([t["date"] for t in group], day_totals)
        freq = (f"{per_week:.1f}x per week" if per_week >= 1
                else f"{len(group) / months:.1f}x per month")
        habits.append({
            "type": "merchant_frequency",
            "title": f"Regular at {name}",
            "description": (
                f"You pay at {name} {freq}"
                + (f", mostly {pattern['when']}" if pattern else "")
                + f", about EUR {statistics.mean(amounts):.2f} each time "
                f"(EUR {total / months:.0f} per month)."
            ),
            "category": group[0]["category"],
            "merchant": name,
            "stats": {
                "transactions": len(group),
                "visits_per_week": _r(per_week),
                "average_amount": _r(statistics.mean(amounts)),
                "amount_range": [_r(min(amounts)), _r(max(amounts))],
                "monthly_spend": _r(total / months),
                "weekday_pattern": pattern,
            },
        })
    habits.sort(key=lambda h: -h["stats"]["monthly_spend"])
    return habits[:HABIT_TOP_MERCHANTS]


def _seasonal_habits(spend, start, end):
    month_list = [month_key(m) for m in iter_months(start, end)]
    by_cat = defaultdict(lambda: defaultdict(list))
    for t in spend:
        by_cat[t["category"]][month_key(t["date"])].append(-t["amount"])

    habits = []
    for category, per_month in sorted(by_cat.items()):
        totals = {m: sum(per_month.get(m, [])) for m in month_list}
        year_total = sum(totals.values())
        if year_total < SEASONAL_MIN_CATEGORY_TOTAL:
            continue
        median = statistics.median(totals.values())
        peaks = []
        for m in month_list:
            amounts = per_month.get(m, [])
            total = totals[m]
            if total < SEASONAL_MIN_MONTH_TOTAL or total < SEASONAL_RATIO * median:
                continue
            if max(amounts) >= ONE_OFF_SHARE * total:
                continue
            peaks.append(m)
        if not peaks:
            continue
        peak_total = sum(totals[m] for m in peaks)
        names = [MONTHS[int(m[5:])] for m in peaks]
        months_text = names[0] if len(names) == 1 else ", ".join(names[:-1]) + " and " + names[-1]
        ratio = (peak_total / len(peaks)) / median if median else None
        habits.append({
            "type": "seasonal_category",
            "title": f"{category.capitalize()} peaks in {months_text}",
            "description": (
                f"EUR {peak_total:.0f} on {category} in {months_text}, "
                f"{peak_total / year_total * 100:.0f}% of your yearly {category} spend"
                + (f" ({ratio:.1f}x a normal month)." if ratio else ".")
            ),
            "category": category,
            "merchant": None,
            "stats": {
                "peak_months": peaks,
                "peak_total": _r(peak_total),
                "typical_month": _r(median),
                "ratio_vs_typical": _r(ratio) if ratio else None,
                "share_of_year_pct": _r(peak_total / year_total * 100),
            },
        })
    return habits


def _payday_habit(txs, spend, start, end, excluded_days):
    paydays = sorted({t["date"] for t in txs if t["amount"] > 0 and t["category"] == "income"})
    if len(paydays) < 3:
        return None
    window = {p + timedelta(days=i) for p in paydays for i in range(PAYDAY_WINDOW_DAYS)}
    daily = defaultdict(float)
    for t in spend:
        daily[t["date"]] -= t["amount"]

    inside, outside = [], []
    d = start
    while d <= end:
        if d not in excluded_days:
            (inside if d in window else outside).append(daily.get(d, 0.0))
        d += timedelta(days=1)
    if not inside or not outside:
        return None
    avg_in, avg_out = statistics.mean(inside), statistics.mean(outside)
    if avg_out <= 0 or avg_in / avg_out < PAYDAY_MIN_RATIO:
        return None
    pct = (avg_in / avg_out - 1) * 100
    return {
        "type": "payday",
        "title": "You spend more right after payday",
        "description": (
            f"In the {PAYDAY_WINDOW_DAYS} days after your salary arrives you spend "
            f"{pct:.0f}% more per day (EUR {avg_in:.0f} vs EUR {avg_out:.0f})."
        ),
        "category": None,
        "merchant": None,
        "stats": {
            "window_days": PAYDAY_WINDOW_DAYS,
            "avg_daily_after_payday": _r(avg_in),
            "avg_daily_other_days": _r(avg_out),
            "increase_pct": _r(pct),
        },
    }


def detect_habits(txs, spend, start, end, excluded_days):
    day_totals = weekday_counts(start, end)
    habits = (
        _merchant_habits(spend, day_totals, start, end)
        + _weekday_habits(spend, day_totals)
        + _seasonal_habits(spend, start, end)
    )
    payday = _payday_habit(txs, spend, start, end, excluded_days)
    if payday:
        habits.append(payday)
    for i, h in enumerate(habits, start=1):
        h["id"] = f"habit_{i:02d}"
    return [{"id": h.pop("id"), **h} for h in habits]


# ---------------------------------------------------------------- expensive periods

def _label_period(start, end, txs_in, extra):
    by_cat = Counter()
    for t in txs_in:
        by_cat[t["category"]] -= t["amount"]
    top_cat = by_cat.most_common(1)[0][0] if by_cat else None
    months = {start.month, end.month}
    largest = min(txs_in, key=lambda t: t["amount"]) if txs_in else None

    if top_cat == "travel" or (months & {7, 8} and by_cat["travel"] >= 0.3 * extra):
        return "summer_holiday", "Summer holiday"
    if 12 in months:
        return "holiday_season", "Holiday season and gifts"
    if months & {8, 9} and (by_cat["education"] > 0 or top_cat == "shopping"):
        return "back_to_school", "Back to school"
    if largest and -largest["amount"] >= ONE_OFF_SHARE * extra:
        return "one_off", f"Large purchase at {largest['merchant']}"
    return "spending_spike", "Spending spike"


def detect_expensive_periods(spend, start, end, as_of):
    first_monday = start - timedelta(days=start.weekday())
    weeks = []
    w = first_monday
    while w <= end:
        weeks.append(w)
        w += timedelta(days=7)
    totals = defaultdict(float)
    merchant_weekly = Counter()
    for t in spend:
        totals[t["date"] - timedelta(days=t["date"].weekday())] -= t["amount"]
        merchant_weekly[t["merchant"]] -= t["amount"]
    history_weeks = ((end - start).days + 1) / 7
    for m in merchant_weekly:
        merchant_weekly[m] /= history_weeks

    stats = []
    for i, w in enumerate(weeks):
        lo, hi = max(0, i - PERIOD_WINDOW_WEEKS), min(len(weeks), i + PERIOD_WINDOW_WEEKS + 1)
        baseline = statistics.median(totals[weeks[j]] for j in range(lo, hi) if j != i)
        stats.append((i, w, totals[w], baseline))

    def above(item, ratio, extra):
        _, _, actual, baseline = item
        return baseline > 0 and actual >= ratio * baseline and actual - baseline >= extra

    # Strong weeks start a period; moderately elevated neighbours extend it.
    flagged = {s[0] for s in stats if above(s, PERIOD_MIN_RATIO, PERIOD_MIN_EXTRA)}
    for i in sorted(flagged):
        for step in (-1, 1):
            j = i + step
            while 0 <= j < len(stats) and j not in flagged and above(stats[j], PERIOD_EXTEND_RATIO, PERIOD_EXTEND_EXTRA):
                flagged.add(j)
                j += step

    groups = []
    for i in sorted(flagged):
        if groups and i == groups[-1][-1][0] + 1:
            groups[-1].append(stats[i])
        else:
            groups.append([stats[i]])

    periods = []
    for n, group in enumerate(groups, start=1):
        p_start = max(group[0][1], start)
        p_end = min(group[-1][1] + timedelta(days=6), end)
        actual = sum(g[2] for g in group)
        baseline = sum(g[3] for g in group)
        extra = actual - baseline
        txs_in = [t for t in spend if p_start <= t["date"] <= p_end]
        kind, title = _label_period(p_start, p_end, txs_in, extra)

        by_cat, by_merchant = Counter(), Counter()
        for t in txs_in:
            by_cat[t["category"]] -= t["amount"]
            by_merchant[t["merchant"]] -= t["amount"]
        largest = min(txs_in, key=lambda t: t["amount"])
        period_weeks = ((p_end - p_start).days + 1) / 7
        merchant_extra = Counter({m: a - merchant_weekly[m] * period_weeks for m, a in by_merchant.items()})

        period = {
            "id": f"period_{n:02d}",
            "kind": kind,
            "title": title,
            "start": p_start.isoformat(),
            "end": p_end.isoformat(),
            "weeks": len(group),
            "spent": _r(actual),
            "baseline": _r(baseline),
            "extra_spend": _r(extra),
            "ratio_vs_baseline": _r(actual / baseline),
            "top_categories": [
                {"category": c, "amount": _r(a), "share_pct": _r(a / actual * 100)}
                for c, a in by_cat.most_common(3)
            ],
            "top_merchants": [
                {"merchant": m, "amount": _r(by_merchant[m]), "extra_vs_usual": _r(x)}
                for m, x in merchant_extra.most_common(3)
            ],
            "largest_transaction": {
                "id": largest["id"],
                "merchant": largest["merchant"],
                "amount": _r(-largest["amount"]),
                "date": largest["date"].isoformat(),
            },
            "why": (
                f"EUR {actual:.0f} in {len(group)} week(s) vs a usual EUR {baseline:.0f} "
                f"({actual / baseline:.1f}x the median of the surrounding weeks)"
            ),
            "next_occurrence": None,
        }
        if kind in YEARLY_PERIOD_KINDS:
            nxt = add_months(p_start, 12)
            while nxt <= as_of:
                nxt = add_months(nxt, 12)
            months_left = max(1, (nxt.year - as_of.year) * 12 + nxt.month - as_of.month)
            period["next_occurrence"] = {
                "expected_start": nxt.isoformat(),
                "days_until": (nxt - as_of).days,
                "months_until": months_left,
                "suggested_monthly_saving": _r(extra / months_left),
            }
        periods.append(period)
    return periods


# ---------------------------------------------------------------- income

def detect_income(txs, as_of):
    by_source = defaultdict(list)
    for t in txs:
        if t["amount"] > 0:
            by_source[t["key"]].append(t)

    streams = []
    for group in by_source.values():
        if len(group) < 3:
            continue
        dates = [t["date"] for t in group]
        match = _match_cadence([(b - a).days for a, b in zip(dates, dates[1:])])
        if not match or match[4] < MIN_GAP_REGULARITY:
            continue
        cadence_name, cadence_days, tol, _, _ = match
        last = group[-1]["date"]
        if (as_of - last).days > cadence_days * 1.5 + tol:
            continue
        streams.append({
            "source": Counter(t["merchant"] for t in group).most_common(1)[0][0],
            "cadence": cadence_name,
            "amount": _r(statistics.median(t["amount"] for t in group)),
            "last_date": last.isoformat(),
            "next_expected_date": _next_date(last, cadence_name, cadence_days).isoformat(),
        })
    return streams


# ---------------------------------------------------------------- forecast

def _month_len(m):
    return calendar.monthrange(m.year, m.month)[1]


def _range_sum(daily, month, first_day, last_day):
    last_day = min(last_day, _month_len(month))
    return sum(daily.get(date(month.year, month.month, k), 0.0) for k in range(first_day, last_day + 1))


def _occurrences(first, cadence, until):
    d = first
    while d <= until:
        yield d
        d = _next_date(d, cadence, CADENCE_DAYS[cadence])


def forecast_month(spend, income_txs, recurring_ids, subscriptions, income_streams, start, as_of):
    """Where does the current month stand, and where will it end?

    "Typical" values are medians over all complete earlier months, so one
    expensive month does not distort them.
    """
    month = date(as_of.year, as_of.month, 1)
    length = _month_len(month)
    month_end = date(month.year, month.month, length)
    first_full = date(start.year, start.month, 1)
    if start.day != 1:
        first_full = add_months(first_full, 1)
    prior = list(iter_months(first_full, month - timedelta(days=1)))
    if not prior:
        return None

    total_daily, disc_daily = defaultdict(float), defaultdict(float)
    for t in spend:
        total_daily[t["date"]] -= t["amount"]
        if t["id"] not in recurring_ids:
            disc_daily[t["date"]] -= t["amount"]

    def typical(daily, first_day, last_day):
        if first_day > last_day:
            return 0.0
        return statistics.median(_range_sum(daily, m, first_day, last_day) for m in prior)

    today = as_of.day
    spent_so_far = _range_sum(total_daily, month, 1, today)
    typical_by_today = typical(total_daily, 1, today)
    diff = spent_so_far - typical_by_today
    diff_pct = diff / typical_by_today * 100 if typical_by_today else 0.0
    if diff_pct > PACE_TOLERANCE_PCT:
        status = "above"
    elif diff_pct < -PACE_TOLERANCE_PCT:
        status = "below"
    else:
        status = "on_track"

    remaining_recurring = sorted(
        (
            {"merchant": s["merchant"], "date": d.isoformat(), "amount": s["amount"], "kind": s["kind"]}
            for s in subscriptions if s["status"] == "active"
            for d in _occurrences(date.fromisoformat(s["next_expected_date"]), s["cadence"], month_end)
            if d > as_of
        ),
        key=lambda r: r["date"],
    )
    remaining_recurring_total = sum(r["amount"] for r in remaining_recurring)
    remaining_discretionary = typical(disc_daily, today + 1, length)
    projected_spend = spent_so_far + remaining_recurring_total + remaining_discretionary
    typical_month = typical(total_daily, 1, 31)

    income_so_far = sum(t["amount"] for t in income_txs if month <= t["date"] <= as_of)
    remaining_income = sorted(
        (
            {"source": s["source"], "date": d.isoformat(), "amount": s["amount"]}
            for s in income_streams
            for d in _occurrences(date.fromisoformat(s["next_expected_date"]), s["cadence"], month_end)
            if d > as_of
        ),
        key=lambda r: r["date"],
    )
    projected_income = income_so_far + sum(r["amount"] for r in remaining_income)

    daily = []
    for k in range(1, length + 1):
        point = {
            "day": k,
            "date": date(month.year, month.month, k).isoformat(),
            "actual": None,
            "typical": _r(typical(total_daily, 1, k)),
            "projected": None,
        }
        if k <= today:
            point["actual"] = _r(_range_sum(total_daily, month, 1, k))
        if k >= today:
            due = sum(r["amount"] for r in remaining_recurring if date.fromisoformat(r["date"]).day <= k)
            point["projected"] = _r(spent_so_far + due + typical(disc_daily, today + 1, k))
        daily.append(point)

    month_name = MONTHS[month.month]
    return {
        "month": month_key(month),
        "as_of": as_of.isoformat(),
        "day_of_month": today,
        "days_in_month": length,
        "month_to_date": {
            "spent": _r(spent_so_far),
            "typical_by_today": _r(typical_by_today),
            "difference": _r(diff),
            "difference_pct": _r(diff_pct),
            "status": status,
            "income": _r(income_so_far),
            "message": (
                f"You spent EUR {spent_so_far:.0f} so far in {month_name}. By day {today} you usually "
                f"spend EUR {typical_by_today:.0f} ({diff_pct:+.0f}%)."
            ),
        },
        "end_of_month": {
            "projected_spend": _r(projected_spend),
            "typical_month_spend": _r(typical_month),
            "remaining_recurring": remaining_recurring,
            "remaining_recurring_total": _r(remaining_recurring_total),
            "remaining_discretionary_estimate": _r(remaining_discretionary),
            "remaining_income": remaining_income,
            "projected_income": _r(projected_income),
            "projected_net": _r(projected_income - projected_spend),
            "message": (
                f"Expected to end {month_name} at EUR {projected_spend:.0f} spent "
                f"(a typical month is EUR {typical_month:.0f}), "
                f"EUR {projected_income - projected_spend:+.0f} after income."
            ),
        },
        "daily": daily,
    }


def upcoming_periods(periods, as_of):
    latest_by_kind = {}
    for p in periods:
        if p["next_occurrence"]:
            latest_by_kind[p["kind"]] = p

    out = []
    for p in latest_by_kind.values():
        nxt = p["next_occurrence"]
        days = nxt["days_until"]
        weeks = max(1, days // 7)
        weekly = p["extra_spend"] / weeks
        drivers = ", ".join(m["merchant"] for m in p["top_merchants"][:2])
        out.append({
            "period_id": p["id"],
            "kind": p["kind"],
            "title": p["title"],
            "expected_start": nxt["expected_start"],
            "days_until": days,
            "alert": days <= UPCOMING_ALERT_DAYS,
            "last_time": {
                "start": p["start"],
                "end": p["end"],
                "spent": p["spent"],
                "extra_spend": p["extra_spend"],
                "top_merchants": p["top_merchants"],
            },
            "suggested_weekly_saving": _r(weekly),
            "message": (
                f"{p['title']} usually starts around {fmt_day(date.fromisoformat(nxt['expected_start']))}, "
                f"in {days} days. Last time it cost EUR {p['extra_spend']:.0f} more than normal "
                f"(mostly {drivers}). Setting aside EUR {weekly:.0f} a week covers it."
            ),
        })
    out.sort(key=lambda u: u["days_until"])
    return out


# ---------------------------------------------------------------- changes

def detect_habit_shifts(discretionary, start, as_of, excluded_days):
    """Categories whose recent spend clearly differs from the long-run normal."""
    recent_start = as_of - timedelta(days=SHIFT_RECENT_DAYS - 1)
    if (recent_start - start).days < SHIFT_MIN_HISTORY_DAYS:
        return []

    recent_days, base_days = set(), set()
    d = start
    while d <= as_of:
        if d >= recent_start:
            recent_days.add(d)
        elif d not in excluded_days:
            base_days.add(d)
        d += timedelta(days=1)

    spend = defaultdict(lambda: [0.0, 0.0])
    counts = defaultdict(lambda: [0, 0])
    for t in discretionary:
        if t["date"] in recent_days:
            spend[t["category"]][0] -= t["amount"]
            counts[t["category"]][0] += 1
        elif t["date"] in base_days:
            spend[t["category"]][1] -= t["amount"]
            counts[t["category"]][1] += 1

    shifts = []
    for category, (recent, base) in spend.items():
        if base < SHIFT_MIN_CATEGORY_TOTAL:
            continue
        recent_m = recent / len(recent_days) * 30.44
        base_m = base / len(base_days) * 30.44
        change_pct = (recent_m / base_m - 1) * 100
        if abs(change_pct) < SHIFT_MIN_CHANGE_PCT or abs(recent_m - base_m) < SHIFT_MIN_MONTHLY_DELTA:
            continue
        recent_w = counts[category][0] / len(recent_days) * 7
        base_w = counts[category][1] / len(base_days) * 7
        if max(counts[category][0], base_w * len(recent_days) / 7) < SHIFT_MIN_PAYMENTS:
            continue
        direction = "up" if change_pct > 0 else "down"
        shifts.append({
            "category": category,
            "direction": direction,
            "recent_monthly": _r(recent_m),
            "usual_monthly": _r(base_m),
            "change_pct": _r(change_pct),
            "recent_per_week": _r(recent_w),
            "usual_per_week": _r(base_w),
            "window_days": SHIFT_RECENT_DAYS,
            "message": (
                f"{category.capitalize()} is {direction} {abs(change_pct):.0f}% in the last "
                f"{SHIFT_RECENT_DAYS // 7} weeks: EUR {recent_m:.0f} a month instead of EUR {base_m:.0f} "
                f"({recent_w:.1f} payments a week instead of {base_w:.1f})."
            ),
        })
    shifts.sort(key=lambda s: -abs(s["change_pct"]))
    return shifts


def detect_changes(subscriptions, discretionary, start, as_of, excluded_days):
    new, price_changes, cancelled = [], [], []
    for s in subscriptions:
        first = date.fromisoformat(s["first_charge"])
        last = date.fromisoformat(s["last_charge"])
        if (s["status"] == "active"
                and (first - start).days >= NEW_SUBSCRIPTION_MIN_HISTORY_DAYS
                and (as_of - first).days <= NEW_SUBSCRIPTION_DAYS):
            new.append({
                "merchant": s["merchant"],
                "kind": s["kind"],
                "since": s["first_charge"],
                "amount": s["amount"],
                "yearly_cost": s["yearly_cost"],
                "message": (
                    f"New {s['kind'].replace('_', ' ')}: {s['merchant']}, EUR {s['amount']:.2f} "
                    f"{s['cadence'].replace('_', '-')} since {fmt_day(first)} (EUR {s['yearly_cost']:.0f} a year)."
                ),
            })
        pc = s["price_change"]
        if s["status"] == "active" and pc and (as_of - date.fromisoformat(pc["date"])).days <= RECENT_PRICE_CHANGE_DAYS:
            price_changes.append({
                "merchant": s["merchant"],
                **pc,
                "yearly_impact": _r((pc["to"] - pc["from"]) * s["yearly_cost"] / s["amount"]),
                "message": (
                    f"{s['merchant']} went from EUR {pc['from']:.2f} to EUR {pc['to']:.2f} "
                    f"on {fmt_day(date.fromisoformat(pc['date']))} ({pc['change_pct']:+.0f}%)."
                ),
            })
        if s["status"] == "cancelled" and (as_of - last).days <= RECENT_CANCELLATION_DAYS:
            cancelled.append({
                "merchant": s["merchant"],
                "last_charge": s["last_charge"],
                "amount": s["amount"],
                "message": f"{s['merchant']} stopped after {fmt_day(last, year=True)}.",
            })
    return {
        "new_subscriptions": new,
        "price_changes": price_changes,
        "cancelled": cancelled,
        "habit_shifts": detect_habit_shifts(discretionary, start, as_of, excluded_days),
    }


def build_feed(forecast, upcoming, changes):
    """Ready-to-render cards for the app, most important first."""
    cards = []
    for u in upcoming:
        if u["alert"]:
            cards.append((1, "upcoming_expensive_period", f"Coming up: {u['title'].lower()}", u["message"]))
    if forecast:
        mtd = forecast["month_to_date"]
        if mtd["status"] == "above":
            cards.append((1, "month_pace", "Spending faster than usual this month", mtd["message"]))
        elif mtd["status"] == "below":
            cards.append((3, "month_pace", "Spending less than usual this month", mtd["message"]))
    for s in changes["new_subscriptions"]:
        cards.append((2, "new_subscription", f"New subscription: {s['merchant']}", s["message"]))
    for s in changes["habit_shifts"]:
        cards.append((2, "habit_shift", f"{s['category'].capitalize()} spending is {s['direction']}", s["message"]))
    for p in changes["price_changes"]:
        cards.append((2, "price_change", f"{p['merchant']} got more expensive" if p["to"] > p["from"]
                      else f"{p['merchant']} got cheaper", p["message"]))
    if forecast:
        cards.append((3, "month_forecast", "End of month forecast", forecast["end_of_month"]["message"]))
    cards.sort(key=lambda c: c[0])
    return [
        {"id": f"card_{i:02d}", "priority": p, "type": t, "title": title, "message": msg}
        for i, (p, t, title, msg) in enumerate(cards, start=1)
    ]


# ---------------------------------------------------------------- orchestration

def analyze(transactions, as_of=None):
    """Analyze all transactions up to and including as_of (default: last transaction date)."""
    txs = parse(transactions)
    if as_of:
        txs = [t for t in txs if t["date"] <= as_of]
    start = txs[0]["date"]
    as_of = as_of or txs[-1]["date"]
    end = as_of
    spend = [t for t in txs if t["amount"] < 0]
    income_txs = [t for t in txs if t["amount"] > 0]

    subscriptions = detect_subscriptions(txs, as_of)
    recurring_ids = {i for s in subscriptions for i in s["transaction_ids"]}
    discretionary = [t for t in spend if t["id"] not in recurring_ids]

    periods = detect_expensive_periods(discretionary, start, end, as_of)
    period_days = set()
    for p in periods:
        d = date.fromisoformat(p["start"])
        while d <= date.fromisoformat(p["end"]):
            period_days.add(d)
            d += timedelta(days=1)
    habits = detect_habits(txs, discretionary, start, end, period_days)

    income_streams = detect_income(txs, as_of)
    forecast = forecast_month(spend, income_txs, recurring_ids, subscriptions, income_streams, start, as_of)
    upcoming = upcoming_periods(periods, as_of)
    if forecast:
        forecast["upcoming_periods"] = upcoming
    changes = detect_changes(subscriptions, discretionary, start, as_of, period_days)

    monthly = []
    for m in iter_months(start, end):
        key = month_key(m)
        month_spend = [t for t in spend if month_key(t["date"]) == key]
        rec = -sum(t["amount"] for t in month_spend if t["id"] in recurring_ids)
        total = -sum(t["amount"] for t in month_spend)
        monthly.append({
            "month": key,
            "complete": m >= start and date(m.year, m.month, _month_len(m)) <= as_of,
            "total": _r(total),
            "recurring": _r(rec),
            "discretionary": _r(total - rec),
            "income": _r(sum(t["amount"] for t in income_txs if month_key(t["date"]) == key)),
        })

    active = [s for s in subscriptions if s["status"] == "active"]
    upcoming_charges = sorted(
        (
            {"merchant": s["merchant"], "date": s["next_expected_date"], "amount": s["amount"], "kind": s["kind"]}
            for s in active
            if (date.fromisoformat(s["next_expected_date"]) - as_of).days <= 30
        ),
        key=lambda u: u["date"],
    )
    by_cat = Counter()
    for t in spend:
        by_cat[t["category"]] -= t["amount"]
    total_spent = sum(by_cat.values())
    complete = [m for m in monthly if m["complete"]] or monthly

    summary = {
        "period_start": start.isoformat(),
        "period_end": end.isoformat(),
        "as_of": as_of.isoformat(),
        "total_spent": _r(total_spent),
        "total_income": _r(sum(t["amount"] for t in txs if t["amount"] > 0)),
        "average_monthly_spent": _r(statistics.mean(m["total"] for m in complete)),
        "recurring_monthly_total": _r(sum(s["monthly_cost"] for s in active)),
        "subscriptions_monthly_total": _r(sum(s["monthly_cost"] for s in active if s["kind"] == "subscription")),
        "recurring_share_of_spend_pct": _r(
            -sum(t["amount"] for t in spend if t["id"] in recurring_ids) / total_spent * 100
        ),
        "active_subscriptions": sum(s["kind"] == "subscription" for s in active),
        "active_recurring_bills": sum(s["kind"] == "recurring_bill" for s in active),
        "cancelled_subscriptions": sum(s["status"] == "cancelled" for s in subscriptions),
        "expensive_periods": len(periods),
        "top_categories": [
            {"category": c, "amount": _r(a), "share_pct": _r(a / total_spent * 100)}
            for c, a in by_cat.most_common(5)
        ],
    }

    return {
        "summary": summary,
        "feed": build_feed(forecast, upcoming, changes),
        "forecast": forecast,
        "changes": changes,
        "subscriptions": subscriptions,
        "upcoming_charges": upcoming_charges,
        "income_streams": income_streams,
        "habits": habits,
        "expensive_periods": periods,
        "monthly_spend": monthly,
        "meta": {
            "generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
            "transactions_analyzed": len(txs),
            "currency": "EUR",
            "amounts": "positive euros spent (income positive in monthly_spend.income)",
            "method": {
                "subscriptions": (
                    "Group spend by normalized merchant; accept when the gaps between charges match "
                    "a known cadence (weekly to yearly) and the amount is stable between consecutive charges."
                ),
                "habits": (
                    "On non-recurring spend: weekday concentration vs an even spread, frequent merchants, "
                    "category months at 2x a normal month, and daily spend after payday vs other days."
                ),
                "expensive_periods": (
                    "Weekly non-recurring spend vs the median of the 4 weeks before and after; "
                    "weeks at 1.7x and EUR 150 above baseline are flagged and merged."
                ),
                "forecast": (
                    "Month so far vs the median of earlier months up to the same day; end of month = spent so far "
                    "+ scheduled recurring charges + typical discretionary spend for the remaining days."
                ),
                "changes": (
                    "Recurring charges that started in the last 120 days, recent price changes and cancellations, "
                    "and categories whose last 8 weeks differ at least 30% from the long-run monthly average."
                ),
            },
        },
    }
