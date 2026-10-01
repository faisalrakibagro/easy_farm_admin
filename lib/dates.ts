/**
 * YYYY-MM-DD of a moment in the user's own timezone. Not toISOString(): that
 * is UTC, so in Bangladesh (UTC+6) it gives yesterday until 6 AM, and the 1st
 * of a month at local midnight becomes the last day of the month before.
 */
export function localDateStr(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
