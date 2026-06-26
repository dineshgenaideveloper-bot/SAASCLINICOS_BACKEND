// server/utils/reportDateRange.js
//
// Turns query params into a { start, end, label } window.
// Supported query params (any one block):
//   ?period=today
//   ?period=week
//   ?period=month            (current month)
//   ?period=year             (current year)
//   ?period=all              (everything)
//   ?month=3&year=2026       (a specific month)
//   ?year=2025               (a whole year)
//   ?from=2026-01-01&to=2026-01-31   (custom range)
//
// If nothing is passed it defaults to the CURRENT MONTH.

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function fmt(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}-${MONTHS[d.getMonth()].slice(0, 3)}-${d.getFullYear()}`;
}

function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function endOfDay(d) { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; }

function getDateRange(query = {}) {
  const { period, from, to, month, year } = query;
  const now = new Date();
  const y = Number(year) || now.getFullYear();

  // 1. Custom from / to
  if (from || to) {
    const start = startOfDay(from ? new Date(from) : new Date(0));
    const end = endOfDay(to ? new Date(to) : now);
    return { start, end, label: `${fmt(start)} to ${fmt(end)}` };
  }

  // 2. Specific month (+ year)
  if (month) {
    const m = Math.max(0, Math.min(11, Number(month) - 1));
    const start = new Date(y, m, 1, 0, 0, 0, 0);
    const end = new Date(y, m + 1, 0, 23, 59, 59, 999);
    return { start, end, label: `${MONTHS[m]} ${y}` };
  }

  // 3. Whole year
  if (year && !period) {
    const start = new Date(y, 0, 1, 0, 0, 0, 0);
    const end = new Date(y, 11, 31, 23, 59, 59, 999);
    return { start, end, label: `Year ${y}` };
  }

  // 4. Named periods
  switch (period) {
    case 'today':
      return { start: startOfDay(now), end: endOfDay(now), label: `Today (${fmt(now)})` };
    case 'yesterday': {
      const d = new Date(now); d.setDate(d.getDate() - 1);
      return { start: startOfDay(d), end: endOfDay(d), label: `Yesterday (${fmt(d)})` };
    }
    case 'week': {
      const d = new Date(now); d.setDate(d.getDate() - 6);
      return { start: startOfDay(d), end: endOfDay(now), label: `Last 7 days` };
    }
    case 'year': {
      const start = new Date(y, 0, 1, 0, 0, 0, 0);
      const end = new Date(y, 11, 31, 23, 59, 59, 999);
      return { start, end, label: `Year ${y}` };
    }
    case 'all':
      return { start: new Date(0), end: new Date('2999-12-31'), label: 'All time' };
    case 'month':
    default: {
      // default = current month
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return { start, end, label: `${MONTHS[now.getMonth()]} ${now.getFullYear()}` };
    }
  }
}

module.exports = { getDateRange, fmt, MONTHS };