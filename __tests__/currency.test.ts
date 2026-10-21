import { formatNaira, formatKobo, parseNaira, toKobo, fromKobo } from '../src/currency';

describe('formatNaira', () => {
  it('formats a whole number with kobo by default', () => {
    expect(formatNaira(1000)).toBe('₦1,000.00');
  });

  it('hides kobo when showKobo is false', () => {
    expect(formatNaira(1000, { showKobo: false })).toBe('₦1,000');
  });

  it('handles negative amounts', () => {
    expect(formatNaira(-500)).toBe('-₦500.00');
  });

  it('formats large numbers with thousands separators', () => {
    expect(formatNaira(1234567.89)).toBe('₦1,234,567.89');
  });

  it('abbreviates thousands', () => {
    expect(formatNaira(450000, { abbreviate: true })).toBe('₦450k');
  });

  it('abbreviates millions', () => {
    expect(formatNaira(1250000, { abbreviate: true })).toBe('₦1.25m');
  });

  it('supports NGN symbol style', () => {
    expect(formatNaira(1000, { symbol: 'NGN' })).toBe('NGN 1,000.00');
  });

  it('supports no symbol', () => {
    expect(formatNaira(1000, { symbol: 'none' })).toBe('1,000.00');
  });

  it('throws on non-finite input', () => {
    expect(() => formatNaira(NaN)).toThrow(TypeError);
  });
});

describe('parseNaira', () => {
  it('parses a formatted string with symbol and commas', () => {
    expect(parseNaira('₦1,200.50')).toBe(1200.5);
  });

  it('parses NGN-prefixed strings', () => {
    expect(parseNaira('NGN 1,200')).toBe(1200);
  });

  it('parses negative amounts', () => {
    expect(parseNaira('-₦500')).toBe(-500);
  });

  it('throws on unparseable input', () => {
    expect(() => parseNaira('not a number')).toThrow(TypeError);
  });
});

describe('toKobo / fromKobo', () => {
  it('converts naira to kobo without floating point drift', () => {
    expect(toKobo(19.99)).toBe(1999);
    expect(toKobo(1200.5)).toBe(120050);
  });

  it('converts kobo back to naira', () => {
    expect(fromKobo(120050)).toBe(1200.5);
    expect(fromKobo(1999)).toBe(19.99);
  });

  it('round-trips cleanly', () => {
    const original = 999.75;
    expect(fromKobo(toKobo(original))).toBe(original);
  });
});

// ---------------------------------------------------------------------------
// Regression tests for v0.2.0 fixes
// ---------------------------------------------------------------------------

describe('parseNaira: strictness and sign handling', () => {
  it('keeps the sign when it follows the symbol', () => {
    expect(parseNaira('₦-500')).toBe(-500);
    expect(parseNaira('NGN -500')).toBe(-500);
    expect(parseNaira('-₦500')).toBe(-500);
  });

  it('parses accounting-style negatives', () => {
    expect(parseNaira('(₦500.25)')).toBe(-500.25);
  });

  it('accepts plain and N-prefixed numbers', () => {
    expect(parseNaira('1000')).toBe(1000);
    expect(parseNaira('N1,000')).toBe(1000);
    expect(parseNaira('₦.5')).toBe(0.5);
  });

  it.each([
    '1.2m', '12abc', '1.2.3', '1,2,3', '1.200,50', '1e3', '₦1,000 only',
    '--5', '-₦-5', '', '   ', 'Infinity', 'naira 5', '₦', '1,00',
  ])('rejects %j instead of guessing', (input) => {
    expect(() => parseNaira(input)).toThrow(TypeError);
  });

  it('never returns negative zero', () => {
    expect(Object.is(parseNaira('-0'), 0)).toBe(true);
  });
});

describe('toKobo / fromKobo: decimal-safe, symmetric, bounded', () => {
  it.each([
    [1.005, 101], [8.575, 858], [1.255, 126], [19.99, 1999], [0.1 + 0.2, 30],
    [1200.5, 120050], [0, 0], [0.004, 0], [0.005, 1], [1e-7, 0],
  ])('toKobo(%p) = %p', (naira, kobo) => {
    expect(toKobo(naira)).toBe(kobo);
  });

  it('rounds negatives symmetrically (half away from zero)', () => {
    expect(toKobo(-0.025)).toBe(-3);
    expect(toKobo(-1.005)).toBe(-101);
    expect(Object.is(toKobo(-0.004), 0)).toBe(true);
  });

  it('strict mode rejects sub-kobo precision', () => {
    expect(() => toKobo(1.005, { rounding: 'strict' })).toThrow(RangeError);
    expect(toKobo(19.99, { rounding: 'strict' })).toBe(1999);
  });

  it('throws RangeError beyond the safe-integer range', () => {
    expect(() => toKobo(1e17)).toThrow(RangeError);
    expect(() => toKobo(1e21)).toThrow(RangeError);
  });

  it('throws TypeError for non-finite or non-number input', () => {
    expect(() => toKobo(NaN)).toThrow(TypeError);
    // @ts-expect-error intentional bad input
    expect(() => toKobo('10')).toThrow(TypeError);
  });

  it('fromKobo rejects fractional kobo instead of silently rounding', () => {
    expect(() => fromKobo(1.5)).toThrow(RangeError);
    expect(() => fromKobo(120050.7)).toThrow(RangeError);
    expect(() => fromKobo(NaN)).toThrow(TypeError);
  });

  it('round-trips every 2-decimal amount (property check over 100k values)', () => {
    for (let k = -50_000; k < 50_000; k++) {
      expect(toKobo(fromKobo(k))).toBe(k);
    }
  });
});

describe('formatNaira: rounding, abbreviation boundaries, edge values', () => {
  it('rounds half-up on the decimal value', () => {
    expect(formatNaira(1.005)).toBe('₦1.01');
    expect(formatNaira(8.575)).toBe('₦8.58');
  });

  it('never rounds money up when kobo is hidden (truncates toward zero)', () => {
    expect(formatNaira(1999.99, { showKobo: false })).toBe('₦1,999');
    expect(formatNaira(1999.5, { showKobo: false })).toBe('₦1,999');
    expect(formatNaira(0.99, { showKobo: false })).toBe('₦0');
    expect(formatNaira(-1999.99, { showKobo: false })).toBe('-₦1,999');
    expect(formatNaira(-0.99, { showKobo: false })).toBe('₦0'); // no negative zero
  });

  it("rounds to nearest only when asked: rounding: 'round'", () => {
    expect(formatNaira(1999.99, { showKobo: false, rounding: 'round' })).toBe('₦2,000');
    expect(formatNaira(1999.49, { showKobo: false, rounding: 'round' })).toBe('₦1,999');
    expect(formatNaira(-1999.99, { showKobo: false, rounding: 'round' })).toBe('-₦2,000');
  });

  it('abbreviations truncate: a display never overstates the amount', () => {
    expect(formatNaira(999999, { abbreviate: true })).toBe('₦999.99k');
    expect(formatNaira(999999999, { abbreviate: true })).toBe('₦999.99m');
    expect(formatNaira(1999999, { abbreviate: true })).toBe('₦1.99m');
    expect(formatNaira(1234.5, { abbreviate: true })).toBe('₦1.23k');
    expect(formatNaira(1250000, { abbreviate: true })).toBe('₦1.25m');
    expect(formatNaira(1.15e6, { abbreviate: true })).toBe('₦1.15m'); // 1.15*100 is 114.99999999999999 in floats
  });

  it("abbreviation with rounding: 'round' promotes tiers at the boundary", () => {
    expect(formatNaira(999999, { abbreviate: true, rounding: 'round' })).toBe('₦1m');
    expect(formatNaira(999999999, { abbreviate: true, rounding: 'round' })).toBe('₦1b');
    expect(formatNaira(1999999, { abbreviate: true, rounding: 'round' })).toBe('₦2m');
  });

  it('abbreviated output never exceeds the true amount (property check)', () => {
    const unit: Record<string, number> = { k: 1e3, m: 1e6, b: 1e9, t: 1e12 };
    for (let n = 1000; n < 5e12; n = Math.floor(n * 1.37) + 13) {
      const text = formatNaira(n, { abbreviate: true }).replace('₦', '').replace(/,/g, '');
      const shown = parseFloat(text) * unit[text.slice(-1)];
      expect(shown).toBeLessThanOrEqual(n);
    }
  });

  it('supports billions and trillions', () => {
    expect(formatNaira(2.5e9, { abbreviate: true })).toBe('₦2.5b');
    expect(formatNaira(1e12, { abbreviate: true })).toBe('₦1t');
    expect(formatNaira(1.5e12, { abbreviate: true })).toBe('₦1.5t');
  });

  it('abbreviates small amounts without noise', () => {
    expect(formatNaira(12, { abbreviate: true })).toBe('₦12');
    expect(formatNaira(12.5, { abbreviate: true })).toBe('₦12.50');
    expect(formatNaira(0.7999999999999999)).toBe('₦0.80'); // float noise absorbed at the kobo level
    expect(formatNaira(-1500, { abbreviate: true })).toBe('-₦1.5k');
  });

  it('never prints a negative zero', () => {
    expect(formatNaira(-0.001)).toBe('₦0.00');
    expect(formatNaira(-0)).toBe('₦0.00');
  });

  it('throws a RangeError (not garbage) for amounts beyond the safe range', () => {
    expect(() => formatNaira(1e21)).toThrow(RangeError);
    expect(() => formatNaira(1e17)).toThrow(RangeError);
  });
});

describe('formatKobo', () => {
  it('formats integer kobo, e.g. from a payment webhook', () => {
    expect(formatKobo(120050)).toBe('₦1,200.50');
    expect(formatKobo(5)).toBe('₦0.05');
    expect(formatKobo(-100)).toBe('-₦1.00');
    expect(formatKobo(123456789, { showKobo: false })).toBe('₦1,234,567');
  });

  it('rejects non-integer kobo', () => {
    expect(() => formatKobo(1.5)).toThrow(TypeError);
  });

  it('agrees with formatNaira for every amount in a sweep', () => {
    for (let k = -3000; k <= 3000; k += 7) {
      expect(formatKobo(k)).toBe(formatNaira(fromKobo(k)));
    }
  });
});
