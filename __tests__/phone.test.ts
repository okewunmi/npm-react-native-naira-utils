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

describe('v0.2.0 regression: structural validation and human formats', () => {
  it.each([
    '+234 (0) 803 123 4567', '+2340803 123 4567', '002348031234567', '2348031234567',
    '0803-123-4567', '(0803) 123 4567', '8031234567',
  ])('accepts %j', (input) => {
    expect(isValidNGPhone(input)).toBe(true);
    expect(formatNGPhone(input)).toBe('08031234567');
    expect(formatNGPhone(input, { format: 'international' })).toBe('+2348031234567');
  });

  it.each(['09111234567', '07075551234', '07025551234', '08041234567', '07091234567'])(
    'accepts numbers on allocated prefixes the old table missed: %s',
    (input) => {
      expect(isValidNGPhone(input)).toBe(true);
    }
  );

  it.each([
    '0803123456', '080312345678', '0303123456', '05001234567', '02012345678', '', 'abc',
    '+1 415 555 2671',
  ])('rejects %j', (input) => {
    expect(isValidNGPhone(input)).toBe(false);
  });

  it('detects networks on the newly covered prefixes', () => {
    expect(detectNetwork('09111234567')).toBe('Airtel');
    expect(detectNetwork('07075551234')).toBe('MTN');
    expect(detectNetwork('07025551234')).toBe('MTN');
    expect(detectNetwork('07035551234')).toBe('MTN');
  });

  it("labels other licensees' blocks as 'other' rather than guessing", () => {
    expect(detectNetwork('08041234567')).toBe('other');
    expect(detectNetwork('07091234567')).toBe('other');
    expect(detectNetwork('07021234567')).toBe('other'); // 0702 but not 07025/07026
  });

  it("returns 'unknown' for a structurally valid number on an unlisted prefix", () => {
    expect(isValidNGPhone('09171234567')).toBe(true);
    expect(detectNetwork('09171234567')).toBe('unknown');
  });

  it('detects the same network for every accepted input format', () => {
    ['+234 (0) 803 123 4567', '002348031234567', '8031234567'].forEach((n) =>
      expect(detectNetwork(n)).toBe('MTN')
    );
  });
});
