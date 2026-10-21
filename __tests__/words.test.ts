import { nairaInWords } from '../src/words';

describe('nairaInWords', () => {
  it.each([
    [0, 'Zero Naira Only'],
    [100, 'One Naira Only'],
    [5000, 'Fifty Naira Only'],
    [10100, 'One Hundred and One Naira Only'],
    [100050, 'One Thousand Naira, Fifty Kobo Only'],
    [123400, 'One Thousand, Two Hundred and Thirty-Four Naira Only'],
    [105000, 'One Thousand and Fifty Naira Only'],
    [100000100, 'One Million and One Naira Only'],
    [125000000, 'One Million, Two Hundred and Fifty Thousand Naira Only'],
    [200005000, 'Two Million and Fifty Naira Only'],
    [1000000000, 'Ten Million Naira Only'],
    [1500000, 'Fifteen Thousand Naira Only'],
    [1, 'One Kobo Only'],
    [50, 'Fifty Kobo Only'],
    [2599, 'Twenty-Five Naira, Ninety-Nine Kobo Only'],
    [-12500, 'Minus One Hundred and Twenty-Five Naira Only'],
    [100000000000, 'One Billion Naira Only'],
  ])('%p kobo -> %s', (kobo, words) => {
    expect(nairaInWords(kobo)).toBe(words);
  });

  it('supports options', () => {
    expect(nairaInWords(100050, { only: false })).toBe('One Thousand Naira, Fifty Kobo');
    expect(nairaInWords(100050, { casing: 'upper' })).toBe('ONE THOUSAND NAIRA, FIFTY KOBO ONLY');
    expect(nairaInWords(100050, { casing: 'lower' })).toBe('one thousand naira, fifty kobo only');
    expect(nairaInWords(100050, { casing: 'sentence' })).toBe('One thousand naira, fifty kobo only');
  });

  it('covers every value from 0 to 999 without gaps or double spaces (property check)', () => {
    for (let n = 0; n < 1000; n++) {
      const text = nairaInWords(n * 100);
      expect(text).not.toMatch(/\s{2,}|undefined|,\s*,|^\s|\s$/);
      expect(text.endsWith('Naira Only')).toBe(true);
    }
  });

  it('handles the largest safe amount', () => {
    expect(nairaInWords(Number.MAX_SAFE_INTEGER)).toMatch(/^Ninety Trillion/);
  });

  it('rejects non-integer kobo', () => {
    expect(() => nairaInWords(1.5)).toThrow(TypeError);
    expect(() => nairaInWords(NaN)).toThrow(TypeError);
  });
});
