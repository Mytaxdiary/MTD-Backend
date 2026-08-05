/**
 * Template variable substitution for chase emails/SMS.
 *
 * Supported variables:
 *   {name}        – preferred name if set, otherwise first name (greeting)
 *   {business}    – client's business / trading name
 *   {quarter}     – e.g. "Q1 2026–27"
 *   {deadline}    – e.g. "7 August 2026"
 *   {agent_name}  – logged-in agent's name
 *   {firm_name}   – firm name
 */
export type TemplateVars = {
  name: string;
  business: string;
  quarter: string;
  deadline: string;
  agent_name: string;
  firm_name: string;
};

/**
 * Name used in chase greetings: preferred name if set, else first token of full name.
 * e.g. preferred "Tom" → Tom;
 */
export function chaseGreetingName(fullName: string, preferredName?: string | null): string {
  const preferred = preferredName?.trim();
  if (preferred) return preferred;
  const first = fullName.trim().split(/\s+/)[0];
  return first || fullName.trim();
}

export function renderTemplate(template: string, vars: TemplateVars): string {
  return template
    .replace(/{name}/g, vars.name)
    .replace(/{business}/g, vars.business)
    .replace(/{quarter}/g, vars.quarter)
    .replace(/{deadline}/g, vars.deadline)
    .replace(/{agent_name}/g, vars.agent_name)
    .replace(/{firm_name}/g, vars.firm_name);
}

// ── UK Tax Quarter helpers ────────────────────────────────────────────────────

export type QuarterInfo = {
  /** e.g. "Q1 2026–27" */
  label: string;
  /** e.g. "7 August 2026" (formatted for emails) */
  deadlineFormatted: string;
  /** raw deadline Date */
  deadline: Date;
  /** first day of the obligation period (e.g. 6 Apr for Q1) */
  periodStartDate: Date;
  /** last day of the obligation period (e.g. 5 Jul for Q1) */
  periodEndDate: Date;
  /** positive = days overdue, negative = days remaining */
  daysOverdue: number;
  /** positive = days since period ended, negative = period still open */
  daysSincePeriodEnd: number;
};

/**
 * UK MTD quarters for a given tax year start (April 6):
 *   Q1: 6 Apr – 5 Jul   → due 7 Aug
 *   Q2: 6 Jul – 5 Oct   → due 7 Nov
 *   Q3: 6 Oct – 5 Jan   → due 7 Feb
 *   Q4: 6 Jan – 5 Apr   → due 7 May
 */
function taxYearQuarters(taxYearStart: number): QuarterInfo[] {
  const y = taxYearStart;
  const label = (q: number) => `Q${q} ${y}–${String(y + 1).slice(2)}`;

  const quarters: { q: number; periodStart: Date; periodEnd: Date; deadline: Date }[] = [
    {
      q: 1,
      periodStart: new Date(y, 3, 6),
      periodEnd: new Date(y, 6, 5),
      deadline: new Date(y, 7, 7),
    }, // 6 Apr – 5 Jul → 7 Aug
    {
      q: 2,
      periodStart: new Date(y, 6, 6),
      periodEnd: new Date(y, 9, 5),
      deadline: new Date(y, 10, 7),
    }, // 6 Jul – 5 Oct → 7 Nov
    {
      q: 3,
      periodStart: new Date(y, 9, 6),
      periodEnd: new Date(y + 1, 0, 5),
      deadline: new Date(y + 1, 1, 7),
    }, // 6 Oct – 5 Jan → 7 Feb
    {
      q: 4,
      periodStart: new Date(y + 1, 0, 6),
      periodEnd: new Date(y + 1, 3, 5),
      deadline: new Date(y + 1, 4, 7),
    }, // 6 Jan – 5 Apr → 7 May
  ];

  const now = new Date();
  return quarters.map(({ q, periodStart, periodEnd, deadline }) => ({
    label: label(q),
    deadlineFormatted: deadline.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }),
    deadline,
    periodStartDate: periodStart,
    periodEndDate: periodEnd,
    daysOverdue: Math.floor((now.getTime() - deadline.getTime()) / 86_400_000),
    daysSincePeriodEnd: Math.floor((now.getTime() - periodEnd.getTime()) / 86_400_000),
  }));
}

/**
 * Returns the most actionable quarter for the given date:
 *  – If any deadline has passed by ≤ 180 days (overdue window), return that.
 *  – If any period has ended (daysSincePeriodEnd >= 1), return that (chase window open).
 *  – Otherwise return the next upcoming deadline.
 * This is used to populate {quarter} and {deadline} in templates.
 */
export function currentChaseQuarter(): QuarterInfo {
  const now = new Date();
  // Current UK tax year: starts 6 Apr
  const taxYearStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;

  const quarters = taxYearQuarters(taxYearStart);

  // Overdue quarters within the last 180 days (most recent first)
  const overdue = quarters
    .filter((q) => q.daysOverdue > 0 && q.daysOverdue <= 180)
    .sort((a, b) => b.daysOverdue - a.daysOverdue);

  if (overdue.length > 0) return overdue[0];

  // Period has ended but deadline not yet passed — chase window is open
  const periodEnded = quarters
    .filter((q) => q.daysSincePeriodEnd >= 1 && q.daysOverdue <= 0)
    .sort((a, b) => b.daysSincePeriodEnd - a.daysSincePeriodEnd);

  if (periodEnded.length > 0) return periodEnded[0];

  // Upcoming: earliest future period end date
  const upcoming = quarters
    .filter((q) => q.daysSincePeriodEnd < 1)
    .sort((a, b) => a.periodEndDate.getTime() - b.periodEndDate.getTime());

  if (upcoming.length > 0) return upcoming[0];

  // Fallback: earliest quarter of next tax year
  const nextYearQuarters = taxYearQuarters(taxYearStart + 1);
  return nextYearQuarters[0];
}
