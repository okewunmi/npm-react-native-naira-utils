import { applyBasisPoints, splitKobo } from '../src/arith';

// BigInt is the independent reference (the package itself avoids it for ES2019 targets).
const BI = (globalThis as unknown as { BigInt: (n: number | string) => any }).BigInt;
function refBp(kobo: number, bp: number, mode: 'nearest' | 'down' | 'up'): number {
  const sign = kobo < 0 ? -1 : 1;
  const a = BI(Math.abs(kobo)) * BI(bp);
  const d = BI(10000);
  let q = a / d;
  const r = a % d;
  if (mode === 'nearest' && r * BI(2) >= d) q += BI(1);
  if (mode === 'up' && r > BI(0)) q += BI(1);
  const n = Number(q);
  return n === 0 ? 0 : sign * n;
}

describe('applyBasisPoints', () => {
  it('computes common rates exactly', () => {
    expect(applyBasisPoints(1000000, 750)).toBe(75000); // 7.5% of ₦10,000
    expect(applyBasisPoints(5000000, 150)).toBe(75000); // 1.5% of ₦50,000
    expect(applyBasisPoints(0, 750)).toBe(0);
  });

  it('rounds the fractional kobo as asked', () => {
    // 1 kobo * 7.5% = 0.075 kobo; 10 kobo -> 0.75; 7 kobo -> 0.525
    expect(applyBasisPoints(10, 750, 'nearest')).toBe(1);
    expect(applyBasisPoints(10, 750, 'down')).toBe(0);
    expect(applyBasisPoints(10, 750, 'up')).toBe(1);
    expect(applyBasisPoints(1, 750, 'up')).toBe(1);
    expect(applyBasisPoints(1, 750, 'nearest')).toBe(0);
  });

  it('is symmetric for negatives and never returns -0', () => {
    expect(applyBasisPoints(-10, 750)).toBe(-1);
    expect(Object.is(applyBasisPoints(-1, 750), 0)).toBe(true);
  });

  it('matches a BigInt reference, including amounts where kobo*bp exceeds 2^53', () => {
    let seed = 12345;
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    const modes = ['nearest', 'down', 'up'] as const;
    for (let i = 0; i < 20000; i++) {
      const kobo = Math.floor(rnd() * (i % 2 ? 9e15 : 1e9)) * (rnd() < 0.2 ? -1 : 1);
      const bp = Math.floor(rnd() * 10001);
      const mode = modes[i % 3];
      expect(applyBasisPoints(kobo, bp, mode)).toBe(refBp(kobo, bp, mode));
    }
  });

  it('rejects bad input', () => {
    expect(() => applyBasisPoints(1.5, 750)).toThrow(TypeError);
    expect(() => applyBasisPoints(100, -1)).toThrow(RangeError);
    expect(() => applyBasisPoints(100, 7.5)).toThrow(TypeError);
  });
});

describe('splitKobo', () => {
  it('splits without creating or losing a kobo', () => {
    expect(splitKobo(10000, 3)).toEqual([3334, 3333, 3333]);
    expect(splitKobo(100, 3)).toEqual([34, 33, 33]);
    expect(splitKobo(10000, [50, 30, 20])).toEqual([5000, 3000, 2000]);
    expect(splitKobo(0, 4)).toEqual([0, 0, 0, 0]);
  });

  it('gives the extra kobo to the largest remainders, ties to the earlier part', () => {
    expect(splitKobo(10, [1, 1, 1])).toEqual([4, 3, 3]);
    expect(splitKobo(2, [1, 2])).toEqual([1, 1]); // 0.67 vs 1.33: remainders .67 and .33
    expect(splitKobo(5, [1, 0, 1])).toEqual([3, 0, 2]);
  });

  it('handles negatives symmetrically', () => {
    expect(splitKobo(-10000, 3)).toEqual([-3334, -3333, -3333]);
  });

  it('always sums exactly to the total and stays within 1 kobo of the ideal (property check)', () => {
    let seed = 99;
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    for (let i = 0; i < 5000; i++) {
      const total = Math.floor(rnd() * 1e12);
      const n = 1 + Math.floor(rnd() * 12);
      const weights: number[] = Array.from({ length: n }, () => Math.floor(rnd() * 100));
      if (weights.reduce((a, b) => a + b, 0) === 0) weights[0] = 1;
      const parts = splitKobo(total, weights);
      expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
      const W = weights.reduce((a, b) => a + b, 0);
      parts.forEach((p, k) => {
        const ideal = (total * weights[k]) / W;
        expect(Math.abs(p - ideal)).toBeLessThan(1 + 1e-6 * Math.max(1, ideal / 1e6));
        if (weights[k] === 0) expect(p).toBe(0);
      });
    }
  });

  it('rejects bad input', () => {
    expect(() => splitKobo(100, 0)).toThrow(RangeError);
    expect(() => splitKobo(100, [])).toThrow(RangeError);
    expect(() => splitKobo(100, [0, 0])).toThrow(RangeError);
    expect(() => splitKobo(100, [1, -1])).toThrow(RangeError);
    expect(() => splitKobo(100.5, 2)).toThrow(TypeError);
  });
});
