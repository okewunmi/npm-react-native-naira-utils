/**
 * Currency utilities for Naira (₦) amounts.
 *
 * Convention: all "amount" values in this module are Naira as a number
 * (e.g. 1200.50), NOT kobo. Use `toKobo` / `fromKobo` when talking to
 * payment APIs (Paystack, Flutterwave, etc.) that expect integer kobo.
 */

export interface FormatNairaOptions {
  /** Show the decimal/kobo part (e.g. ₦1,000.50). Default: true */
  showKobo?: boolean;
  /** Abbreviate large numbers, e.g. ₦1.2m, ₦450k. Default: false */
  abbreviate?: boolean;
  /** Currency symbol style. Default: '₦' */
  symbol?: '₦' | 'NGN' | 'none';
}

const DEFAULT_FORMAT_OPTIONS: Required<FormatNairaOptions> = {
  showKobo: true,
  abbreviate: false,
  symbol: '₦',
};

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

/**
 * Format a Naira amount (number) into a human-readable string.
 *
 * formatNaira(1000)                        -> "₦1,000.00"
 * formatNaira(1000, { showKobo: false })    -> "₦1,000"
 * formatNaira(1250000, { abbreviate: true })-> "₦1.25m"
 * formatNaira(-500)                         -> "-₦500.00"
 */
export function formatNaira(amount: number, options: FormatNairaOptions = {}): string {
  if (!Number.isFinite(amount)) {
    throw new TypeError(`formatNaira: amount must be a finite number, got ${amount}`);
  }

  const opts = { ...DEFAULT_FORMAT_OPTIONS, ...options };
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  const prefix = getSymbolPrefix(opts.symbol);
  const sign = isNegative ? '-' : '';

  if (opts.abbreviate) {
    return `${sign}${prefix}${abbreviateNumber(absAmount)}`;
  }

  const parts = absAmount.toFixed(2).split('.');
  const wholeWithCommas = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const formatted = opts.showKobo ? `${wholeWithCommas}.${parts[1]}` : wholeWithCommas;

  return `${sign}${prefix}${formatted}`;
}

function abbreviateNumber(value: number): string {
  const tiers: Array<[number, string]> = [
    [1_000_000_000, 'b'],
    [1_000_000, 'm'],
    [1_000, 'k'],
  ];

  for (const [threshold, suffix] of tiers) {
    if (value >= threshold) {
      const scaled = value / threshold;
      // Trim trailing .0 (e.g. "1.0m" -> "1m") but keep meaningful decimals.
      const rounded = Math.round(scaled * 100) / 100;
      return `${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toString()}${suffix}`;
    }
  }

  return value.toFixed(2).replace(/\.00$/, '');
}

/**
 * Parse a formatted Naira string back into a number.
 *
 * parseNaira("₦1,200.50") -> 1200.5
 * parseNaira("NGN 1,200") -> 1200
 * parseNaira("-₦500")     -> -500
 *
 * Does NOT expand abbreviations like "1.2m" — abbreviated strings are lossy
 * by design and should not be parsed back for financial calculations.
 */
export function parseNaira(input: string): number {
  if (typeof input !== 'string') {
    throw new TypeError('parseNaira: input must be a string');
  }

  const isNegative = /^\s*-/.test(input) || /^\s*\(.*\)\s*$/.test(input);
  const cleaned = input.replace(/[₦NGNngn,()\s]/g, '').replace(/^-/, '');
  const value = parseFloat(cleaned);

  if (Number.isNaN(value)) {
    throw new TypeError(`parseNaira: unable to parse "${input}" as a Naira amount`);
  }

  return isNegative ? -value : value;
}

/**
 * Convert a Naira amount to an integer kobo value, suitable for payment
 * APIs (Paystack, Flutterwave, etc.) that require whole-number kobo.
 *
 * Uses rounding to avoid floating-point artifacts (e.g. 19.99 * 100
 * evaluating to 1998.9999999999998 in raw JS arithmetic).
 *
 * toKobo(1200.5) -> 120050
 */
export function toKobo(amountInNaira: number): number {
  if (!Number.isFinite(amountInNaira)) {
    throw new TypeError(`toKobo: amount must be a finite number, got ${amountInNaira}`);
  }
  return Math.round(amountInNaira * 100);
}

/**
 * Convert an integer kobo value back into a Naira amount.
 *
 * fromKobo(120050) -> 1200.5
 */
export function fromKobo(amountInKobo: number): number {
  if (!Number.isFinite(amountInKobo)) {
    throw new TypeError(`fromKobo: amount must be a finite number, got ${amountInKobo}`);
  }
  return Math.round(amountInKobo) / 100;
}
