const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parts(isoDate: string): { y: number; m: number; d: number } {
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number);
  return { y, m, d };
}

/** "23 Nov 2026" from an ISO date. Avoids locale and time zone surprises. */
export function formatDate(isoDate: string): string {
  const { y, m, d } = parts(isoDate);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** "16–22 Nov 2026" for a range inside one month, otherwise both dates in full. */
export function formatDateRange(start: string, end: string): string {
  const a = parts(start);
  const b = parts(end);
  if (a.y === b.y && a.m === b.m) return `${a.d}–${b.d} ${MONTHS[a.m - 1]} ${a.y}`;
  return `${formatDate(start)} – ${formatDate(end)}`;
}

/** Local clock time such as "14:05". */
export function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
