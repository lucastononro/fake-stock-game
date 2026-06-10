export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Money/price rounding. Fake-money game: plain floats rounded at the edges.
export const r2 = (value) => Math.round(value * 100) / 100;
export const r4 = (value) => Math.round(value * 10000) / 10000;

export const isoTimestamp = (ms) => new Date(ms).toISOString();
export const todayISO = () => new Date().toISOString().slice(0, 10);
export const dateOfMs = (ms) => new Date(ms).toISOString().slice(0, 10);

export function addDaysISO(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export const diffDays = (fromISO, toISO) =>
  Math.round((Date.parse(`${toISO}T00:00:00Z`) - Date.parse(`${fromISO}T00:00:00Z`)) / 86400000);

/** Calendar-month addition with end-of-month clamping (Jan 31 + 1mo = Feb 28). */
export function addMonths(date, months) {
  const day = date.getUTCDate();
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const daysInTarget = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)
  ).getUTCDate();
  target.setUTCDate(Math.min(day, daysInTarget));
  target.setUTCHours(
    date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds(), date.getUTCMilliseconds()
  );
  return target;
}

export function addMonthsISO(isoDate, months) {
  return addMonths(new Date(`${isoDate}T00:00:00Z`), months).toISOString().slice(0, 10);
}

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no O/0/I/1/L

export function generateInviteCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

/** Index of the last element <= target in a sorted array, or -1. */
export function lastIndexLE(sorted, target) {
  let low = 0;
  let high = sorted.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (sorted[mid] <= target) low = mid + 1;
    else high = mid;
  }
  return low - 1;
}

export function requireFields(body, fields) {
  for (const field of fields) {
    if (body?.[field] === undefined || body?.[field] === null || body?.[field] === "") {
      throw new ApiError(422, `Missing required field '${field}'`);
    }
  }
}

export function positiveNumber(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    throw new ApiError(422, `${label} must be a positive number`);
  }
  return number;
}
