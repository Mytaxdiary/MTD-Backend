/**
 * Template variable substitution for chase emails/SMS.
 *
 * Supported variables:
 *   {name}        – client's full name
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

type QuarterInfo = {
  /** e.g. "Q1 2026–27" */
  label: string;
  /** e.g. "7 August 2026" (formatted for emails) */
  deadlineFormatted: string;
  /** raw deadline Date */
  deadline: Date;
  /** positive = days overdue, negative = days remaining */
  daysOverdue: number;
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

  const quarters: { q: number; deadline: Date }[] = [
    { q: 1, deadline: new Date(y, 7, 7) },   // Aug 7
    { q: 2, deadline: new Date(y, 10, 7) },  // Nov 7
    { q: 3, deadline: new Date(y + 1, 1, 7) }, // Feb 7 next year
    { q: 4, deadline: new Date(y + 1, 4, 7) }, // May 7 next year
  ];

  const now = new Date();
  return quarters.map(({ q, deadline }) => ({
    label: label(q),
    deadlineFormatted: deadline.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }),
    deadline,
    daysOverdue: Math.floor((now.getTime() - deadline.getTime()) / 86_400_000),
  }));
}

/**
 * Returns the most actionable quarter for the given date:
 *  – If any deadline has passed by ≤ 180 days with no response (overdue window), return that.
 *  – Otherwise return the next upcoming deadline.
 * This is used to populate {quarter} and {deadline} in templates.
 */
export function currentChaseQuarter(): QuarterInfo {
  const now = new Date();
  // Current UK tax year: starts 6 Apr
  const taxYearStart =
    now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;

  const quarters = taxYearQuarters(taxYearStart);

  // Overdue quarters within the last 180 days (most recent first)
  const overdue = quarters
    .filter((q) => q.daysOverdue > 0 && q.daysOverdue <= 180)
    .sort((a, b) => b.daysOverdue - a.daysOverdue);

  if (overdue.length > 0) return overdue[0];

  // Upcoming: earliest future deadline
  const upcoming = quarters
    .filter((q) => q.daysOverdue <= 0)
    .sort((a, b) => a.deadline.getTime() - b.deadline.getTime());

  if (upcoming.length > 0) return upcoming[0];

  // Fallback: earliest quarter of next tax year
  const nextYearQuarters = taxYearQuarters(taxYearStart + 1);
  return nextYearQuarters[0];
}
