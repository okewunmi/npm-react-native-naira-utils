import { formatNaira, parseNaira, toKobo, fromKobo } from '../src/currency';

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
