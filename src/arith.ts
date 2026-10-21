/**
 * Exact integer arithmetic on kobo. JavaScript numbers are only exact up to
 * 2^53, and `kobo * basisPoints` overflows that for amounts beyond a few
 * billion naira, so these helpers split the multiplication to stay exact.
 */

/** 'nearest': half away from zero. 'down': toward zero. 'up': away from zero. */
export type KoboRounding = 'nearest' | 'down' | 'up';

export function intDiv(a: number, b: number): number {
  return (a - (a % b)) / b;
}

function assertSafeInt(value: number, name: string, fn: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`${fn}: ${name} must be a safe integer, got ${value}`);
  }
}

/** a * b / c for non-negative safe integers, exact, with explicit rounding. */
function mulDiv(a: number, b: number, c: number, rounding: KoboRounding, fn: string): number {
  const q = intDiv(a, c);
  const r = a % c;
  const whole = q * b;
  const rb = r * b;
  if (!Number.isSafeInteger(whole) || !Number.isSafeInteger(rb)) {
    throw new RangeError(`${fn}: result is too large to compute exactly`);
  }
  const base = intDiv(rb, c);
  const rem = rb % c;
  let bump = 0;
  if (rounding === 'nearest') bump = rem * 2 >= c ? 1 : 0;
  else if (rounding === 'up') bump = rem > 0 ? 1 : 0;
  const result = whole + base + bump;
  if (!Number.isSafeInteger(result)) {
    throw new RangeError(`${fn}: result is too large to compute exactly`);
  }
  return result;
}

/**
 * Apply a rate in basis points (1 bp = 0.01%) to an integer kobo amount.
 * 7.5% is 750 bp; 1.5% is 150 bp. Exact for every safe-integer input.
 *
 * applyBasisPoints(1_000_000, 750) -> 75000   (7.5% of ₦10,000 = ₦750)
 *
 * `rounding` applies to the fractional kobo: 'nearest' (default), 'down'
 * (toward zero) or 'up' (away from zero). Negative amounts are handled
 * symmetrically.
 */
export function applyBasisPoints(
  kobo: number,
  basisPoints: number,
  rounding: KoboRounding = 'nearest'
): number {
  assertSafeInt(kobo, 'kobo', 'applyBasisPoints');
  assertSafeInt(basisPoints, 'basisPoints', 'applyBasisPoints');
  if (basisPoints < 0) throw new RangeError('applyBasisPoints: basisPoints must be >= 0');
  const magnitude = mulDiv(Math.abs(kobo), basisPoints, 10000, rounding, 'applyBasisPoints');
  return kobo < 0 && magnitude !== 0 ? -magnitude : magnitude;
}

/** a * b / c, exact, for non-negative integers (internal use by tax code). */
export function mulDivKobo(
  a: number,
  b: number,
  c: number,
  rounding: KoboRounding = 'nearest'
): number {
  assertSafeInt(a, 'a', 'mulDivKobo');
  assertSafeInt(b, 'b', 'mulDivKobo');
  assertSafeInt(c, 'c', 'mulDivKobo');
  if (a < 0 || b < 0 || c <= 0) throw new RangeError('mulDivKobo: expected a >= 0, b >= 0, c > 0');
  return mulDiv(a, b, c, rounding, 'mulDivKobo');
}

const MAX_WEIGHT_SUM = 94906265; // keeps (total % sum) * weight below 2^53

/**
 * Split an integer kobo total into parts that add up to the total
 * *exactly*, with no kobo created or lost (largest-remainder method).
 * `shares` is either a number of equal parts or an array of positive integer
 * weights. Ties go to the earlier part.
 *
 * splitKobo(10000, 3)            -> [3334, 3333, 3333]
 * splitKobo(10000, [50, 30, 20]) -> [5000, 3000, 2000]
 * splitKobo(100, [1, 1, 1])      -> [34, 33, 33]
 */
export function splitKobo(totalKobo: number, shares: number | ReadonlyArray<number>): number[] {
  assertSafeInt(totalKobo, 'totalKobo', 'splitKobo');
  const weights = typeof shares === 'number' ? new Array<number>(shares).fill(1) : [...shares];
  if (typeof shares === 'number') assertSafeInt(shares, 'shares', 'splitKobo');
  if (weights.length === 0) throw new RangeError('splitKobo: need at least one part');
  weights.forEach((w) => {
    assertSafeInt(w, 'weight', 'splitKobo');
    if (w < 0) throw new RangeError('splitKobo: weights must be >= 0');
  });
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) throw new RangeError('splitKobo: weights must not all be zero');
  if (sum > MAX_WEIGHT_SUM) throw new RangeError('splitKobo: weights are too large to split exactly');

  const negative = totalKobo < 0;
  const total = Math.abs(totalKobo);
  const q = intDiv(total, sum);
  const r = total % sum;

  const floors = weights.map((w) => q * w + intDiv(r * w, sum));
  const remainders = weights.map((w) => (r * w) % sum);
  let leftover = total - floors.reduce((a, b) => a + b, 0);

  const order = weights
    .map((_, i) => i)
    .sort((i, j) => remainders[j] - remainders[i] || i - j);
  for (const i of order) {
    if (leftover <= 0) break;
    if (weights[i] > 0) {
      floors[i] += 1;
      leftover -= 1;
    }
  }
  return negative ? floors.map((p) => (p === 0 ? 0 : -p)) : floors;
}
