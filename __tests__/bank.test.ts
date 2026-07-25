import {
  computeNUBANCheckDigit,
  isValidNUBAN,
  isNUBANChecksumCompatible,
  getBankByCode,
  getBankList,
} from '../src/bank';

describe('computeNUBANCheckDigit', () => {
  // Worked example straight from the CBN NUBAN circular:
  // bank code 011 (First Bank), serial 000001457 -> check digit 9
  it('matches the official CBN worked example', () => {
    expect(computeNUBANCheckDigit('011', '000001457')).toBe(9);
  });

  // Independently verifiable real-world example: GTBank (058), serial 001656322 -> check digit 8
  it('matches a real-world GTBank example', () => {
    expect(computeNUBANCheckDigit('058', '001656322')).toBe(8);
  });

  it('throws on malformed bank code', () => {
    expect(() => computeNUBANCheckDigit('11', '000001457')).toThrow(TypeError);
  });

  it('throws on malformed serial number', () => {
    expect(() => computeNUBANCheckDigit('011', '12345')).toThrow(TypeError);
  });
});

describe('isValidNUBAN', () => {
  it('validates a correctly-formed NUBAN', () => {
    expect(isValidNUBAN('0000014579', '011')).toBe(true);
    expect(isValidNUBAN('0016563228', '058')).toBe(true);
  });

  it('rejects a NUBAN with a wrong check digit', () => {
    expect(isValidNUBAN('0016563229', '058')).toBe(false);
  });

  it('rejects malformed account numbers', () => {
    expect(isValidNUBAN('12345', '058')).toBe(false);
    expect(isValidNUBAN('abcdefghij', '058')).toBe(false);
  });

  it('rejects malformed bank codes', () => {
    expect(isValidNUBAN('0016563228', '58')).toBe(false);
  });
});

describe('bank list helpers', () => {
  it('looks up a known bank by code', () => {
    expect(getBankByCode('058')?.name).toBe('Guaranty Trust Bank');
  });

  it('returns undefined for unknown code', () => {
    expect(getBankByCode('999')).toBeUndefined();
  });

  it('returns a non-empty bank list', () => {
    expect(getBankList().length).toBeGreaterThan(30);
  });

  it('includes commonly used fintech/MFB institutions', () => {
    expect(getBankByCode('50211')?.name).toBe('Kuda Bank');
    expect(getBankByCode('999992')?.name).toBe('OPay');
    expect(getBankByCode('50515')?.name).toBe('Moniepoint MFB');
  });
});

describe('isNUBANChecksumCompatible', () => {
  it('returns true for classic 3-digit CBN codes', () => {
    expect(isNUBANChecksumCompatible({ code: '058', name: 'Guaranty Trust Bank' })).toBe(true);
  });

  it('returns false for longer NIP institution codes', () => {
    expect(isNUBANChecksumCompatible({ code: '50211', name: 'Kuda Bank' })).toBe(false);
    expect(isNUBANChecksumCompatible({ code: '999992', name: 'OPay' })).toBe(false);
  });

  it('returns false for non-numeric codes', () => {
    expect(isNUBANChecksumCompatible({ code: '035A', name: 'ALAT by WEMA' })).toBe(false);
  });
});
