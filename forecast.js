// Kate Ahead: 90-day balance forecast.
// Inputs come from the expense pattern engine (src/detect.py → output/insights_demo.json)
// plus the subscription decisions in ahead.js. Deterministic: no model computes a number.
import { readFileSync } from 'node:fs';

const DAY = 86_400_000;
const stamp = d => Date.parse(d + 'T00:00:00Z');
const iso = t => new Date(t).toISOString().slice(0, 10);
const addDays = (d, n) => iso(stamp(d) + n * DAY);
const round = n => Math.round(n * 100) / 100;
const CADENCE_DAYS = { weekly: 7, biweekly: 14, four_weekly: 28, quarterly: null, yearly: null, monthly: null };

export const HORIZON = 90;
export const BUFFER = 250; // comfort buffer for the demo customer
export const ACTIONS = {
  dining: { id: 'dining', label: 'Bring dining back to your usual' },
  bridge: { id: 'bridge', label: 'Move money from savings before the dip' },
};

export function loadInsights(path = new URL('./output/insights_demo.json', import.meta.url)) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function addMonths(d, n) {
  const t = new Date(stamp(d));
  const y = t.getUTCFullYear(), m = t.getUTCMonth() + n;
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return iso(Date.UTC(y, m, Math.min(t.getUTCDate(), last)));
}
function occurrences(first, cadence, from, to) {
  const out = [];
  let d = first, i = 0;
  while (d && d <= to && i++ < 200) {
    if (d > from) out.push(d);
    d = CADENCE_DAYS[cadence] ? addDays(d, CADENCE_DAYS[cadence])
      : addMonths(d, cadence === 'quarterly' ? 3 : cadence === 'yearly' || cadence === 'annual' ? 12 : 1);
  }
  return out;
}
const quantile = (xs, q) => {
  const s = [...xs].sort((a, b) => a - b), p = (s.length - 1) * q, lo = Math.floor(p);
  return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (p - lo);
};

/**
 * @param {object} o
 * @param {object} o.insights        expense engine output (as of `today`)
 * @param {number} o.startBalance    current account balance today
 * @param {string} o.today           ISO date
 * @param {Array}  o.aheadItems      ahead.js snapshot items (trials/renewals + decisions)
 * @param {Set}    o.applied         applied action ids
 * @param {number} o.savingsBalance  available for the bridge action
 */
export function buildForecast({ insights, startBalance, today, aheadItems = [], applied = new Set(), savingsBalance = Infinity, bridge = null }) {
  const end = addDays(today, HORIZON);
  const flows = []; // {date, amount (signed), label, kind, why}
  if (bridge) flows.push({ date: bridge.date, amount: bridge.amount, label: 'From your savings', kind: 'transfer', why: 'Ready-made action you approved in Kate Ahead.' });

  // 1. Recurring income and bills detected by the expense engine.
  for (const s of insights.income_streams || []) {
    for (const d of occurrences(s.next_expected_date, s.cadence, today, end))
      flows.push({ date: d, amount: s.amount, label: 'Salary · ' + s.source, kind: 'income', why: `Monthly salary, last received ${s.last_date}.` });
  }
  const known = new Set();
  for (const s of insights.subscriptions || []) {
    if (s.status !== 'active' || !s.next_expected_date) continue;
    known.add(s.merchant.toLowerCase());
    for (const d of occurrences(s.next_expected_date, s.cadence, today, end))
      flows.push({ date: d, amount: -s.amount, label: s.merchant, kind: s.kind, why: s.why });
  }

  // 2. Trials and annual renewals from Kate Ahead (respecting keep/stop decisions).
  for (const item of aheadItems) {
    if (['cancellation_requested', 'dismissed'].includes(item.status)) continue;
    if (item.kind === 'subscription' && known.has(item.service.toLowerCase())) continue;
    const cadence = item.cadence === 'monthly' ? 'monthly' : 'yearly';
    for (const d of occurrences(addDays(item.chargeDate, -0), cadence, addDays(today, -1), end))
      if (d > today) flows.push({ date: d, amount: -item.amount, label: item.service, kind: item.kind, why: item.explanation, subscriptionId: item.id });
  }

  // 3. Expensive periods the engine expects to repeat (e.g. holiday season), spread over their length.
  for (const p of insights.forecast?.upcoming_periods || []) {
    const start = p.expected_start;
    if (start > end) continue;
    const period = insights.expensive_periods.find(x => x.id === p.period_id);
    const days = Math.max(1, Math.round((stamp(period.end) - stamp(period.start)) / DAY) + 1);
    const perDay = p.last_time.extra_spend / days;
    for (let i = 0; i < days; i++) {
      const d = addDays(start, i);
      if (d > today && d <= end) flows.push({ date: d, amount: -perDay, label: p.title, kind: 'period', periodId: p.period_id, why: p.message });
    }
  }

  // 4. Everyday (discretionary) spending: median of the last 6 complete months, with a spread.
  const months = (insights.monthly_spend || []).filter(m => m.complete).slice(-6).map(m => m.discretionary);
  let dailySpend = quantile(months, 0.5) / 30.4;
  const monthlySpread = (quantile(months, 0.75) - quantile(months, 0.25)) / 1.35;
  const dining = (insights.changes?.habit_shifts || []).find(h => h.category === 'dining' && h.direction === 'up');
  if (dining && applied.has('dining')) dailySpend -= (dining.recent_monthly - dining.usual_monthly) / 30.4;

  // 5. Day-by-day projection with an uncertainty band (~P10–P90).
  const byDate = new Map();
  for (const f of flows) (byDate.get(f.date) || byDate.set(f.date, []).get(f.date)).push(f);
  const days = [];
  let expected = startBalance, periodVar = 0;
  for (let i = 1; i <= HORIZON; i++) {
    const d = addDays(today, i);
    const todays = byDate.get(d) || [];
    for (const f of todays) {
      expected += f.amount;
      if (f.kind === 'period') periodVar += (0.3 * f.amount) ** 2;
    }
    expected -= dailySpend;
    const sd = Math.sqrt((monthlySpread ** 2) * (i / 30.4) + periodVar);
    days.push({ date: d, expected: round(expected), low: round(expected - 1.28 * sd), high: round(expected + 1.28 * sd) });
  }

  // 6. Risk window: expected below the comfort buffer, or the pessimistic case below zero.
  const risky = d => d.expected < BUFFER || d.low < 0;
  const firstRisk = days.findIndex(risky);
  let risk = null;
  if (firstRisk >= 0) {
    let last = firstRisk;
    while (last + 1 < days.length && risky(days[last + 1])) last++;
    const window = days.slice(firstRisk, last + 1);
    const lowest = window.reduce((a, b) => (b.expected < a.expected ? b : a));
    const causeFrom = addDays(days[firstRisk].date, -30);
    const causes = new Map();
    for (const f of flows) if (f.amount < 0 && f.date >= causeFrom && f.date <= lowest.date) {
      const c = causes.get(f.label) || { label: f.label, amount: 0, kind: f.kind, why: f.why, date: f.date };
      c.amount += -f.amount; causes.set(f.label, c);
    }
    risk = {
      from: days[firstRisk].date, to: days[last].date, lowestDate: lowest.date,
      lowestExpected: lowest.expected, lowestLow: lowest.low,
      severity: window.some(d => d.expected < 0) ? 'shortfall' : 'tight',
      causes: [...causes.values()].sort((a, b) => b.amount - a.amount).slice(0, 4).map(c => ({ ...c, amount: round(c.amount) })),
    };
  }

  // 7. Weather per week.
  const weeks = [];
  for (let i = 0; i < days.length; i += 7) {
    const w = days.slice(i, i + 7);
    const weather = w.some(d => d.expected < 0 || d.low < -BUFFER) ? 'storm' : w.some(risky) ? 'cloudy' : 'sunny';
    weeks.push({ start: w[0].date, end: w.at(-1).date, weather, lowest: round(Math.min(...w.map(d => d.expected))) });
  }

  // 8. Safe to spend until the next salary.
  const nextIncome = flows.filter(f => f.kind === 'income').map(f => f.date).sort()[0] || end;
  const beforePay = days.filter(d => d.date < nextIncome);
  const safeToSpend = Math.max(0, round(Math.min(startBalance, ...beforePay.map(d => d.expected)) - BUFFER));

  // 9. Ready-made actions.
  const actions = [];
  if (dining) actions.push({
    ...ACTIONS.dining, applied: applied.has('dining'),
    detail: `Dining is up ${Math.round(dining.change_pct)}% lately (${Math.round(dining.recent_monthly)} vs ${Math.round(dining.usual_monthly)} a month). Going back to your usual frees about €${Math.round(dining.recent_monthly - dining.usual_monthly)} a month.`,
  });
  if (bridge) actions.push({ ...ACTIONS.bridge, applied: true, amount: bridge.amount, date: bridge.date, detail: `€${bridge.amount} moves from your savings on ${bridge.date}.` });
  else if (risk && savingsBalance > 0) {
    const amount = Math.min(savingsBalance, Math.max(100, Math.ceil((BUFFER - Math.min(risk.lowestExpected, risk.lowestLow + BUFFER)) / 50) * 50));
    const date = addDays(risk.from, -1) > today ? addDays(risk.from, -1) : addDays(today, 1);
    actions.push({ ...ACTIONS.bridge, applied: false, amount, date, detail: `Move €${amount} from your savings on ${date}, the day before it gets tight.` });
  }

  // Upcoming notable events for the timeline list (bigger items only, periods merged).
  const seenPeriods = new Set();
  const events = flows.filter(f => f.kind !== 'period' || (!seenPeriods.has(f.periodId) && seenPeriods.add(f.periodId)))
    .filter(f => Math.abs(f.amount) >= 60 || f.kind === 'trial' || f.kind === 'renewal' || f.kind === 'period' || f.kind === 'income')
    .map(f => f.kind === 'period'
      ? { ...f, amount: -round(insights.forecast.upcoming_periods.find(p => p.period_id === f.periodId).last_time.extra_spend) }
      : { ...f, amount: round(f.amount) })
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    today, horizon: HORIZON, buffer: BUFFER, startBalance: round(startBalance),
    dailySpend: round(dailySpend), days, weeks, risk, safeToSpend, nextIncome, events, actions,
    source: 'Expense pattern engine (recurring bills, income, expensive periods, habits) + Kate Ahead subscription decisions',
  };
}

