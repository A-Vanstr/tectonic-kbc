"""Run the expense pattern engine on a transactions file and write insights.json.

Usage:
    python src/run.py [--as-of YYYY-MM-DD] [path/to/expenses.json] [path/to/insights.json]

--as-of is the "today" to predict from; it defaults to the last transaction date.
"""

import argparse
import json
from datetime import date
from pathlib import Path

from detect import analyze

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_INPUT = ROOT / "data" / "expenses.json"
DEFAULT_OUTPUT = ROOT / "output" / "insights.json"


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("input", nargs="?", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("output", nargs="?", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--as-of", type=date.fromisoformat, default=None)
    args = parser.parse_args()

    transactions = json.loads(args.input.read_text(encoding="utf-8"))
    insights = analyze(transactions, as_of=args.as_of)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(insights, indent=2, ensure_ascii=False), encoding="utf-8")

    s = insights["summary"]
    print(f"Analyzed {insights['meta']['transactions_analyzed']} transactions "
          f"({s['period_start']} to {s['as_of']})")
    print(f"Spent EUR {s['total_spent']:,.2f}, income EUR {s['total_income']:,.2f}")
    print(f"\nRecurring ({s['recurring_monthly_total']:.2f}/month):")
    for sub in insights["subscriptions"]:
        extra = f"  price {sub['price_change']['from']} -> {sub['price_change']['to']}" if sub["price_change"] else ""
        print(f"  [{sub['status']:9}] {sub['kind']:14} {sub['merchant']:22} {sub['cadence']:11} "
              f"EUR {sub['amount']:8.2f}  conf {sub['confidence']}{extra}")
    print("\nHabits:")
    for h in insights["habits"]:
        print(f"  - {h['title']}: {h['description']}")
    print("\nExpensive periods:")
    for p in insights["expensive_periods"]:
        print(f"  - {p['start']} to {p['end']} {p['title']}: +EUR {p['extra_spend']:.0f} "
              f"({p['ratio_vs_baseline']}x)")
    print(f"\nFeed for {s['as_of']}:")
    for card in insights["feed"]:
        print(f"  [{card['priority']}] {card['title']}: {card['message']}")
    print(f"\nWrote {args.output}")


if __name__ == "__main__":
    main()
