import {
  computeNUBANCheckDigit,
  isValidNUBAN,
  isNUBANChecksumCompatible,
  getBankByCode,
  getBankList,
  guessBanks,
  NIGERIAN_BANKS,
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

  it('returns true for 5-digit CBN OFI codes (CBN revised NUBAN standard, 2020)', () => {
    expect(isNUBANChecksumCompatible({ code: '50211', name: 'Kuda Bank' })).toBe(true);
  });

  it('returns false for 6-digit provider/NIP codes', () => {
    expect(isNUBANChecksumCompatible({ code: '999992', name: 'OPay' })).toBe(false);
  });

  it('returns false for non-numeric codes', () => {
    expect(isNUBANChecksumCompatible({ code: '035A', name: 'ALAT by WEMA' })).toBe(false);
  });
});

describe('CBN revised NUBAN standard (3-, 5- and 6-digit institution codes)', () => {
  it('matches the CBN OFI worked example: 50547 + 000021457 -> 9', () => {
    expect(computeNUBANCheckDigit('50547', '000021457')).toBe(9);
    expect(isValidNUBAN('0000214579', '50547')).toBe(true);
  });

  it('matches the CBN DMB example in padded 6-digit form: 000011 + 000001457 -> 9', () => {
    expect(computeNUBANCheckDigit('000011', '000001457')).toBe(9);
    expect(isValidNUBAN('0000014579', '000011')).toBe(true);
  });

  it('matches the CBN 2010 proposal example (serial 000000022 -> check digit 0)', () => {
    expect(computeNUBANCheckDigit('000', '000000022')).toBe(0);
  });

  it('3-digit, padded 6-digit forms always agree', () => {
    for (let i = 0; i < 500; i++) {
      const code = String((i * 7) % 1000).padStart(3, '0');
      const serial = String((i * 2654435761) % 1e9).padStart(9, '0');
      expect(computeNUBANCheckDigit(code, serial)).toBe(computeNUBANCheckDigit(`000${code}`, serial));
    }
  });

  it('rejects institution codes that are not 3, 5 or 6 digits', () => {
    expect(() => computeNUBANCheckDigit('0112', '000001457')).toThrow(TypeError);
    expect(isValidNUBAN('0000014579', '11')).toBe(false);
    expect(isValidNUBAN('0000014579', '035A')).toBe(false);
  });
});

describe('guessBanks', () => {
  it('includes the owning bank among candidates', () => {
    const candidates = guessBanks('0016563228');
    expect(candidates.map((b) => b.code)).toContain('058');
    candidates.forEach((b) => expect(isValidNUBAN('0016563228', b.code)).toBe(true));
  });

  it('returns [] for malformed input', () => {
    expect(guessBanks('123')).toEqual([]);
    // @ts-expect-error intentional bad input
    expect(guessBanks(8031234567)).toEqual([]);
  });

  it('only considers checksum-compatible banks', () => {
    const codes = guessBanks('0016563228').map((b) => b.code);
    expect(codes.every((c) => /^(\d{3}|\d{5})$/.test(c))).toBe(true);
  });

  it('returns copies, not references into the bundled list', () => {
    const [first] = guessBanks('0016563228');
    first.name = 'mutated';
    expect(getBankByCode('058')?.name).not.toBe('mutated');
  });
});

describe('bundled bank list is immutable', () => {
  it('frozen list and entries', () => {
    expect(Object.isFrozen(NIGERIAN_BANKS)).toBe(true);
    expect(Object.isFrozen(NIGERIAN_BANKS[0])).toBe(true);
  });

  it('getBankList returns an independent copy', () => {
    const list = getBankList();
    list.push({ code: 'x', name: 'y' });
    list[0].name = 'mutated';
    expect(getBankList()).toHaveLength(NIGERIAN_BANKS.length);
    expect(getBankList()[0].name).not.toBe('mutated');
  });

  it('has no duplicate codes', () => {
    const codes = NIGERIAN_BANKS.map((b) => b.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});
