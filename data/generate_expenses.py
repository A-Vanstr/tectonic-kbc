"""Generate ~13.5 months of synthetic bank transactions for the demo persona.

Persona: Lotte, 34, lives in Leuven with one child, pays salary into a KBC account.
The data ends on END, the demo "today", right before the December gift period.
Spend amounts are negative, income is positive. Output is deterministic (seeded).

Changes in the second year the engine should notice: ChatGPT Plus starts in
August 2026, Spotify raises its price in September 2026 and she eats out more
often from mid-September 2026.

Usage:
    python data/generate_expenses.py
"""

import calendar
import csv
import json
import random
from datetime import date, timedelta
from pathlib import Path

SEED = 42
START = date(2025, 10, 1)
END = date(2026, 11, 20)
DINING_SHIFT_FROM = date(2026, 9, 15)

DATA_DIR = Path(__file__).parent
JSON_PATH = DATA_DIR / "expenses.json"
CSV_PATH = DATA_DIR / "expenses.csv"

CHRISTMAS = (date(2025, 12, 1), date(2025, 12, 24))
HOLIDAY = (date(2026, 7, 11), date(2026, 7, 25))

RESTAURANTS = [
    "De Werf Leuven",
    "Pizzeria Il Gusto",
    "Sushi Kyoto Leuven",
    "Brasserie Den Boule",
    "Burger Bros Leuven",
    "Thai Siam",
]
SHOPS = ["Bol.com", "Zara Leuven", "Action", "HEMA", "Kruidvat"]
GIFT_SHOPS = ["Bol.com", "MediaMarkt Leuven", "Fnac", "Dreamland", "Zara Leuven"]
HOLIDAY_RESTAURANTS = [
    "Restaurante La Marina",
    "Taberna El Puerto",
    "Chiringuito Sol",
    "Pizzeria Mediterranea",
]


def add_months(d, n):
    month = d.month - 1 + n
    year = d.year + month // 12
    month = month % 12 + 1
    day = min(d.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def month_days(day_of_month):
    """Yield that day in every month in the range (clamped to month length)."""
    d = date(START.year, START.month, 1)
    while d <= END:
        last = calendar.monthrange(d.year, d.month)[1]
        candidate = date(d.year, d.month, min(day_of_month, last))
        if START <= candidate <= END:
            yield candidate
        d = add_months(d, 1)


def in_range(d, window):
    return window[0] <= d <= window[1]


def generate():
    rng = random.Random(SEED)
    txs = []

    def add(d, amount, merchant, category, channel):
        txs.append(
            {
                "date": d.isoformat(),
                "amount": round(amount, 2),
                "merchant": merchant,
                "category": category,
                "channel": channel,
            }
        )

    # Income and fixed bills
    for d in month_days(25):
        add(d, 3420.00, "Salaris Brightline NV", "income", "transfer")
    for d in month_days(1):
        add(d, -975.00, "Immo Verhuur Leuven", "housing", "standing_order")
    for d in month_days(15):
        add(d, -128.00, "Engie Electrabel", "utilities", "direct_debit")
    for d in month_days(20):
        if d.month in (11, 2, 5, 8):
            add(d, -71.80, "De Watergroep", "utilities", "direct_debit")
    for d in month_days(5):
        add(d, -67.50, "Telenet", "telecom", "direct_debit")
    for d in month_days(12):
        add(d, -20.00, "Orange Belgium", "telecom", "direct_debit")
    for d in month_days(10):
        if d.month in (10, 1, 4, 7):
            add(d, -186.40, "KBC Autoverzekering", "insurance", "direct_debit")

    # Subscriptions
    for d in month_days(7):
        price = -13.49 if d < date(2026, 2, 1) else -14.99
        add(d, price, "Netflix", "subscriptions", "card")
    for d in month_days(20):
        price = -11.99 if d < date(2026, 9, 1) else -12.99
        add(d, price, "Spotify", "subscriptions", "card")
    for d in month_days(14):
        if d >= date(2026, 8, 1):
            add(d, -22.99, "OpenAI ChatGPT Plus", "subscriptions", "card")
    for d in month_days(3):
        add(d, -2.99, "Apple iCloud", "subscriptions", "card")
    for d in month_days(18):
        if d <= date(2026, 3, 31):
            add(d, -8.99, "Disney+", "subscriptions", "card")
    d = date(2025, 10, 3)
    while d <= END:
        add(d, -29.99, "Basic-Fit", "subscriptions", "direct_debit")
        d += timedelta(days=28)

    # Day-by-day habits
    next_fuel = START + timedelta(days=rng.randint(2, 8))
    d = START
    while d <= END:
        wd = d.weekday()
        payday_boost = 2.2 if d.day >= 25 else 1.0
        on_holiday = in_range(d, HOLIDAY)

        if on_holiday:
            if rng.random() < 0.9:
                add(d, -rng.uniform(35, 85), rng.choice(HOLIDAY_RESTAURANTS), "dining", "card")
            if rng.random() < 0.4:
                add(d, -rng.uniform(20, 60), "Mercadona", "groceries", "card")
            if rng.random() < 0.25:
                add(d, -rng.uniform(30, 90), "GetYourGuide", "travel", "card")
        else:
            if wd in (1, 5) and rng.random() < 0.9:
                add(d, -rng.uniform(38, 95), "Colruyt Leuven", "groceries", "card")
            if wd == 3 and rng.random() < 0.5:
                add(d, -rng.uniform(8, 32), "Delhaize Leuven", "groceries", "card")
            if rng.random() < 0.06:
                add(d, -rng.uniform(15, 45), "Aldi Heverlee", "groceries", "card")
            if wd in (5, 6) and rng.random() < 0.7:
                add(d, -rng.uniform(4.5, 12), "Bakkerij Vandermeulen", "groceries", "card")
            if wd < 5 and rng.random() < 0.45:
                add(d, -rng.uniform(3.2, 5.8), "Koffie Onan", "coffee", "card")

            dining_p = {4: 0.65, 5: 0.55}.get(wd, 0.05) * payday_boost
            if d >= DINING_SHIFT_FROM:
                dining_p = min(1.0, dining_p * 1.4) + (0.12 if wd in (2, 6) else 0)
            if rng.random() < dining_p:
                add(d, -rng.uniform(28, 78), rng.choice(RESTAURANTS), "dining", "card")

            if d >= next_fuel:
                add(d, -rng.uniform(52, 78), "TotalEnergies Leuven", "transport", "card")
                next_fuel = d + timedelta(days=rng.randint(9, 15))
            if wd < 5 and rng.random() < 0.04:
                add(d, -rng.uniform(9.8, 24), "NMBS/SNCB", "transport", "card")
            if rng.random() < 0.05 * payday_boost:
                add(d, -rng.uniform(12, 85), rng.choice(SHOPS), "shopping", "card")
            if rng.random() < 0.02:
                add(d, -rng.uniform(6, 38), "Apotheek De Linde", "health", "card")

        if in_range(d, CHRISTMAS) and rng.random() < 0.55:
            add(d, -rng.uniform(30, 180), rng.choice(GIFT_SHOPS), "shopping", "card")

        d += timedelta(days=1)

    # Seasonal and one-off events
    add(date(2025, 12, 23), -186.40, "Delhaize Leuven", "groceries", "card")
    add(date(2025, 12, 31), -142.00, "Traiteur Dewilde", "dining", "card")
    add(date(2026, 2, 10), -418.60, "Garage Peeters", "transport", "card")
    add(date(2026, 3, 14), -899.00, "MediaMarkt Leuven", "shopping", "card")
    add(date(2026, 5, 19), -145.00, "Tandarts Janssens", "health", "transfer")
    add(date(2026, 7, 10), -412.00, "Brussels Airlines", "travel", "card")
    add(date(2026, 7, 11), -540.00, "Booking.com", "travel", "card")
    add(date(2026, 7, 18), -480.00, "Booking.com", "travel", "card")
    add(date(2026, 8, 26), -134.50, "Decathlon Leuven", "shopping", "card")
    add(date(2026, 8, 29), -86.40, "Standaard Boekhandel", "education", "card")
    add(date(2026, 8, 30), -118.70, "JBC Leuven", "shopping", "card")
    add(date(2026, 9, 2), -245.00, "Basisschool De Regenboog", "education", "transfer")
    add(date(2026, 9, 5), -42.00, "HEMA", "shopping", "card")

    txs.sort(key=lambda t: t["date"])
    for i, t in enumerate(txs, start=1):
        t["id"] = f"tx_{i:05d}"
    return [{"id": t["id"], **{k: v for k, v in t.items() if k != "id"}} for t in txs]


def main():
    txs = generate()
    JSON_PATH.write_text(json.dumps(txs, indent=2), encoding="utf-8")
    with CSV_PATH.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(txs[0].keys()))
        writer.writeheader()
        writer.writerows(txs)
    spent = -sum(t["amount"] for t in txs if t["amount"] < 0)
    print(f"Wrote {len(txs)} transactions ({START} to {END}), total spent EUR {spent:,.2f}")
    print(f"  {JSON_PATH}")
    print(f"  {CSV_PATH}")


if __name__ == "__main__":
    main()
