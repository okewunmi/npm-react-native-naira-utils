/**
 * Currency utilities for Naira (₦) amounts.
 *
 * Convention: all "amount" values in this module are Naira as a number
 * (e.g. 1200.50), NOT kobo. Use `toKobo` / `fromKobo` when talking to
 * payment APIs (Paystack, Flutterwave, etc.) that expect integer kobo.
 *
 * Implementation note: binary floating point cannot represent most
 * 2-decimal amounts exactly (1.005 * 100 === 100.49999999999999), so every
 * conversion here works on the number's shortest decimal string and on
 * integer kobo, never on `amount * 100` or `toFixed`.
 */

export interface FormatNairaOptions {
  /** Show the decimal/kobo part (e.g. ₦1,000.50). Default: true */
  showKobo?: boolean;
  /** Abbreviate large numbers, e.g. ₦1.2m, ₦450k. Default: false */
  abbreviate?: boolean;
  /** Currency symbol style. Default: '₦' */
  symbol?: '₦' | 'NGN' | 'none';
  /**
   * What to do when display drops real value (hidden kobo with
   * `showKobo: false`, or the digits beyond two decimals when abbreviating).
   * 'truncate' (default): cut toward zero, so a display never overstates an
   * amount (₦1,999.99 shows as ₦1,999; ₦999,999 as ₦999.99k).
   * 'round': round half away from zero (₦1,999.99 -> ₦2,000; ₦999,999 -> ₦1m).
   */
  rounding?: 'truncate' | 'round';
}

export interface ToKoboOptions {
  /**
   * 'half-up' (default): round to the nearest kobo, halves away from zero,
   * using the decimal value of the number (1.005 -> 101, -0.025 -> -3).
   * 'strict': throw a RangeError if the amount has sub-kobo precision.
   */
  rounding?: 'half-up' | 'strict';
}

const DEFAULT_FORMAT_OPTIONS: Required<FormatNairaOptions> = {
  showKobo: true,
  abbreviate: false,
  symbol: '₦',
  rounding: 'truncate',
};

const MAX_WHOLE_NAIRA = Math.floor(Number.MAX_SAFE_INTEGER / 100) - 1;

function getSymbolPrefix(symbol: FormatNairaOptions['symbol']): string {
  switch (symbol) {
    case 'NGN':
      return 'NGN ';
    case 'none':
      return '';
    case '₦':
    default:
      return '₦';
  }
}

function withCommas(wholeDigits: string): string {
  return wholeDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** Naira number -> integer kobo, decimal-safe. Internal; see `toKobo`. */
function decimalToKobo(amount: number, rounding: 'half-up' | 'strict', fn: string): number {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    throw new TypeError(`${fn}: amount must be a finite number, got ${amount}`);
  }
  if (amount === 0) return 0;

  const negative = amount < 0;
  const text = Math.abs(amount).toString();

  if (/e/i.test(text)) {
    // Exponent form: either >= 1e21 or < 1e-6.
    if (Math.abs(amount) >= 1) {
      throw new RangeError(`${fn}: amount ${amount} is too large to represent in kobo safely`);
    }
    if (rounding === 'strict') {
      throw new RangeError(`${fn}: amount ${amount} has sub-kobo precision`);
    }
    return 0; // far below half a kobo
  }

  const [whole, frac = ''] = text.split('.');
  if (Number(whole) > MAX_WHOLE_NAIRA) {
    throw new RangeError(`${fn}: amount ${amount} is too large to represent in kobo safely`);
  }

  const padded = `${frac}00`;
  let kobo = Number(whole) * 100 + Number(padded.slice(0, 2));
  const remainder = frac.slice(2);

  if (/[1-9]/.test(remainder)) {
    if (rounding === 'strict') {
      throw new RangeError(`${fn}: amount ${amount} has sub-kobo precision`);
    }
    if (remainder.charCodeAt(0) >= 53 /* '5' */) kobo += 1;
  }

  return negative && kobo !== 0 ? -kobo : kobo;
}

/** Exact integer division for non-negative safe integers. */
function intDiv(a: number, b: number): number {
  return (a - (a % b)) / b;
}

const TIERS: Array<[number, string]> = [
  [1e12, 't'],
  [1e9, 'b'],
  [1e6, 'm'],
  [1e3, 'k'],
];

/** Hundredths -> "1.25", "1.5", "1", never via floating point. */
function centisToText(centis: number): string {
  const whole = intDiv(centis, 100);
  const frac = centis % 100;
  const wholeText = withCommas(String(whole));
  if (frac === 0) return wholeText;
  const fracText = String(frac).padStart(2, '0').replace(/0$/, '');
  return `${wholeText}.${fracText}`;
}

function abbreviateKobo(absKobo: number, rounding: 'truncate' | 'round'): string {
  for (let i = 0; i < TIERS.length; i++) {
    const [threshold, suffix] = TIERS[i];
    // kobo / threshold(naira) == hundredths of the abbreviated unit.
    if (absKobo >= threshold * 100) {
      let centis = intDiv(absKobo, threshold);
      if (rounding === 'round' && (absKobo % threshold) * 2 >= threshold) centis += 1;
      // Rounding 999.999k up to 1000k: promote to the next tier (1m).
      if (rounding === 'round' && centis >= 100000 && i > 0) {
        const [upThreshold, upSuffix] = TIERS[i - 1];
        let upCentis = intDiv(absKobo, upThreshold);
        if ((absKobo % upThreshold) * 2 >= upThreshold) upCentis += 1;
        return `${centisToText(upCentis)}${upSuffix}`;
      }
      return `${centisToText(centis)}${suffix}`;
    }
  }
  const whole = intDiv(absKobo, 100);
  const k = absKobo % 100;
  return k === 0 ? String(whole) : `${whole}.${String(k).padStart(2, '0')}`;
}

/**
 * Format an integer kobo amount (e.g. straight from a Paystack webhook).
 *
 * formatKobo(120050) -> "₦1,200.50"
 */
export function formatKobo(kobo: number, options: FormatNairaOptions = {}): string {
  if (!Number.isSafeInteger(kobo)) {
    throw new TypeError(`formatKobo: kobo must be a safe integer, got ${kobo}`);
  }
  const opts = { ...DEFAULT_FORMAT_OPTIONS, ...options };
  const prefix = getSymbolPrefix(opts.symbol);
  const absKobo = Math.abs(kobo);

  let body: string;
  let shownIsZero = false;
  if (opts.abbreviate) {
    body = abbreviateKobo(absKobo, opts.rounding);
    shownIsZero = absKobo === 0;
  } else if (opts.showKobo) {
    body = `${withCommas(String(intDiv(absKobo, 100)))}.${String(absKobo % 100).padStart(2, '0')}`;
    shownIsZero = absKobo === 0;
  } else {
    let whole = intDiv(absKobo, 100);
    if (opts.rounding === 'round' && absKobo % 100 >= 50) whole += 1;
    body = withCommas(String(whole));
    shownIsZero = whole === 0;
  }
  // Never print a negative zero ("-₦0").
  const sign = kobo < 0 && !shownIsZero ? '-' : '';
  return `${sign}${prefix}${body}`;
}

/**
 * Format a Naira amount (number) into a human-readable string.
 *
 * formatNaira(1000)                         -> "₦1,000.00"
 * formatNaira(1000, { showKobo: false })    -> "₦1,000"
 * formatNaira(1999.99, { showKobo: false }) -> "₦1,999"   (truncated, never rounded up)
 * formatNaira(1250000, { abbreviate: true })-> "₦1.25m"
 * formatNaira(999999, { abbreviate: true }) -> "₦999.99k"
 * formatNaira(-500)                         -> "-₦500.00"
 *
 * Money is never rounded up for display: when kobo is hidden or an
 * abbreviation drops digits, the value is truncated toward zero. Pass
 * `rounding: 'round'` to opt in to nearest-value rounding instead.
 *
 * The only rounding by default is to the nearest kobo, to absorb floating
 * point noise (0.1 + 0.7 is 0.7999999999999999 in JS and displays as ₦0.80).
 */
export function formatNaira(amount: number, options: FormatNairaOptions = {}): string {
  return formatKobo(decimalToKobo(amount, 'half-up', 'formatNaira'), options);
}

/**
 * Parse a formatted Naira string back into a number.
 *
 * parseNaira("₦1,200.50") -> 1200.5
 * parseNaira("NGN 1,200") -> 1200
 * parseNaira("-₦500")     -> -500
 * parseNaira("₦-500")     -> -500
 * parseNaira("(₦500)")    -> -500
 *
 * Strict by design: anything that isn't a plain, correctly grouped number
 * (optionally with a ₦ / NGN / N prefix and a sign) throws a TypeError.
 * That includes abbreviations ("1.2m"), trailing text ("12abc"), multiple
 * decimal points, misplaced thousands separators ("1,2,3") and European
 * formatting ("1.200,50"). Silent mis-parses are worse than errors for money.
 */
export function parseNaira(input: string): number {
  if (typeof input !== 'string') {
    throw new TypeError('parseNaira: input must be a string');
  }
  const fail = () =>
    new TypeError(`parseNaira: unable to parse "${input}" as a Naira amount`);

  let text = input.trim();
  let negative = false;

  if (/^\(.*\)$/.test(text)) {
    negative = true;
    text = text.slice(1, -1).trim();
  }

  const match = /^(-)?\s*(?:₦|NGN|N)?\s*(-)?\s*(\S+)$/i.exec(text);
  if (!match) throw fail();
  if (match[1] && match[2]) throw fail();
  if (match[1] || match[2]) negative = true;

  const digits = match[3];
  const grouped = /^\d{1,3}(,\d{3})+(\.\d+)?$/;
  const plain = /^(\d+(\.\d*)?|\.\d+)$/;
  if (!grouped.test(digits) && !plain.test(digits)) throw fail();

  const value = Number(digits.replace(/,/g, ''));
  if (!Number.isFinite(value)) throw fail();
  return negative && value !== 0 ? -value : value;
}

/**
 * Convert a Naira amount to an integer kobo value, suitable for payment
 * APIs (Paystack, Flutterwave, etc.) that require whole-number kobo.
 *
 * Works on the decimal value of the number, so there is no floating-point
 * drift (1.005 -> 101, 8.575 -> 858, 19.99 -> 1999) and rounding is
 * symmetric (-0.025 -> -3). Pass `{ rounding: 'strict' }` to reject amounts
 * with sub-kobo precision instead of rounding them. Throws a RangeError for
 * values beyond Number.MAX_SAFE_INTEGER kobo.
 *
 * toKobo(1200.5) -> 120050
 */
export function toKobo(amountInNaira: number, options: ToKoboOptions = {}): number {
  return decimalToKobo(amountInNaira, options.rounding ?? 'half-up', 'toKobo');
}

/**
 * Convert an integer kobo value back into a Naira amount.
 * Throws if `amountInKobo` is not a safe integer (fractional kobo is a bug
 * upstream and should not be silently rounded).
 *
 * fromKobo(120050) -> 1200.5
 */
export function fromKobo(amountInKobo: number): number {
  if (typeof amountInKobo !== 'number' || !Number.isFinite(amountInKobo)) {
    throw new TypeError(`fromKobo: amount must be a finite number, got ${amountInKobo}`);
  }
  if (!Number.isSafeInteger(amountInKobo)) {
    throw new RangeError(`fromKobo: kobo must be a safe integer, got ${amountInKobo}`);
  }
  return amountInKobo / 100;
}
