import { isValidNGPhone, formatNGPhone, detectNetwork } from '../src/phone';

describe('isValidNGPhone', () => {
  it('accepts local format', () => {
    expect(isValidNGPhone('08031234567')).toBe(true);
  });

  it('accepts international format with +', () => {
    expect(isValidNGPhone('+2348031234567')).toBe(true);
  });

  it('accepts international format without +', () => {
    expect(isValidNGPhone('2348031234567')).toBe(true);
  });

  it('accepts numbers with spaces/dashes', () => {
    expect(isValidNGPhone('0803-123-4567')).toBe(true);
    expect(isValidNGPhone('0803 123 4567')).toBe(true);
  });

  it('rejects too-short input', () => {
    expect(isValidNGPhone('12345')).toBe(false);
  });

  it('rejects unknown prefixes', () => {
    expect(isValidNGPhone('05001234567')).toBe(false);
  });

  it('rejects non-string input', () => {
    // @ts-expect-error intentional bad input
    expect(isValidNGPhone(12345678901)).toBe(false);
  });
});

describe('formatNGPhone', () => {
  it('normalizes to local format by default', () => {
    expect(formatNGPhone('+2348031234567')).toBe('08031234567');
  });

  it('formats to international', () => {
    expect(formatNGPhone('08031234567', { format: 'international' })).toBe('+2348031234567');
  });

  it('throws on unrecognizable input', () => {
    expect(() => formatNGPhone('not a phone')).toThrow(TypeError);
  });
});

describe('detectNetwork', () => {
  it('detects MTN prefixes', () => {
    expect(detectNetwork('08031234567')).toBe('MTN');
    expect(detectNetwork('09131234567')).toBe('MTN');
  });

  it('detects Glo prefixes', () => {
    expect(detectNetwork('08051234567')).toBe('Glo');
  });

  it('detects Airtel prefixes', () => {
    expect(detectNetwork('08021234567')).toBe('Airtel');
  });

  it('detects 9mobile prefixes', () => {
    expect(detectNetwork('08091234567')).toBe('9mobile');
  });

  it('returns unknown for unrecognized prefix', () => {
    expect(detectNetwork('05001234567')).toBe('unknown');
  });

  it('returns unknown for invalid input', () => {
    expect(detectNetwork('123')).toBe('unknown');
  });
});
