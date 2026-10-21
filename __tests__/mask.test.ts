import { maskPhone, maskAccountNumber } from '../src/mask';
import { formatNairaInput } from '../src/input';

describe('maskPhone', () => {
  it('masks any accepted input format, showing local format', () => {
    expect(maskPhone('08031234567')).toBe('0803****567');
    expect(maskPhone('+2348031234567')).toBe('0803****567');
    expect(maskPhone('+234 (0) 803 123 4567')).toBe('0803****567');
  });
  it('supports options', () => {
    expect(maskPhone('08031234567', { visibleStart: 0, visibleEnd: 4, maskChar: '•' })).toBe('•••••••4567');
  });
  it('throws for invalid numbers and for revealing everything', () => {
    expect(() => maskPhone('12345')).toThrow(TypeError);
    expect(() => maskPhone('08031234567', { visibleStart: 6, visibleEnd: 5 })).toThrow(RangeError);
  });
});

describe('maskAccountNumber', () => {
  it('shows the last 4 digits by default', () => {
    expect(maskAccountNumber('0016563228')).toBe('******3228');
  });
  it('supports options', () => {
    expect(maskAccountNumber('0016563228', { visibleStart: 3, visibleEnd: 3 })).toBe('001****228');
  });
  it('requires exactly 10 digits', () => {
    expect(() => maskAccountNumber('123')).toThrow(TypeError);
    // @ts-expect-error intentional bad input
    expect(() => maskAccountNumber(1234567890)).toThrow(TypeError);
  });
});

describe('formatNairaInput', () => {
  const t = (raw: string, o?: Parameters<typeof formatNairaInput>[1]) => formatNairaInput(raw, o);

  it('formats as the user types', () => {
    expect(t('')).toEqual({ text: '', kobo: null, exceeded: false });
    expect(t('1')).toEqual({ text: '1', kobo: 100, exceeded: false });
    expect(t('1234')).toEqual({ text: '1,234', kobo: 123400, exceeded: false });
    expect(t('1234567')).toEqual({ text: '1,234,567', kobo: 123456700, exceeded: false });
  });

  it('handles the decimal point and up to two decimals', () => {
    expect(t('.')).toEqual({ text: '0.', kobo: 0, exceeded: false });
    expect(t('12.')).toEqual({ text: '12.', kobo: 1200, exceeded: false });
    expect(t('1234.5')).toEqual({ text: '1,234.5', kobo: 123450, exceeded: false });
    expect(t('1234.56')).toEqual({ text: '1,234.56', kobo: 123456, exceeded: false });
    expect(t('1,234.5')).toEqual({ text: '1,234.5', kobo: 123450, exceeded: false });
  });

  it('cuts (never rounds) extra decimals', () => {
    expect(t('1.999')).toEqual({ text: '1.99', kobo: 199, exceeded: false });
  });

  it('ignores junk, extra dots and leading zeros', () => {
    expect(t('₦1,2a3')).toEqual({ text: '123', kobo: 12300, exceeded: false });
    expect(t('1.2.3')).toEqual({ text: '1.23', kobo: 123, exceeded: false });
    expect(t('007')).toEqual({ text: '7', kobo: 700, exceeded: false });
    expect(t('0')).toEqual({ text: '0', kobo: 0, exceeded: false });
    expect(t('abc')).toEqual({ text: '', kobo: null, exceeded: false });
  });

  it('supports whole-naira-only fields', () => {
    expect(t('12.50', { maxDecimals: 0 })).toEqual({ text: '12', kobo: 1200, exceeded: false });
  });

  it('enforces maxKobo and the safe-integer ceiling', () => {
    const capped = t('999999', { maxKobo: 50000000 }); // ₦500,000 max
    expect(capped).toEqual({ text: '500,000', kobo: 50000000, exceeded: true });
    const huge = t('99999999999999999999');
    expect(huge.exceeded).toBe(true);
    expect(Number.isSafeInteger(huge.kobo as number)).toBe(true);
  });

  it('is idempotent: formatting its own output changes nothing', () => {
    for (const raw of ['1', '1234.5', '0.', '12,345,678.90', '.5', '100']) {
      const once = t(raw);
      expect(t(once.text)).toEqual(once);
    }
  });
});
