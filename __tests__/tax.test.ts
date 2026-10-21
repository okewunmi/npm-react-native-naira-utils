import { addVAT, removeVAT, calculatePAYE, createPayeRule, NTA_2025_PAYE, VAT_RATE_BP } from '../src/tax';

const N = (naira: number) => naira * 100;

describe('VAT (7.5%)', () => {
  it('adds VAT exactly', () => {
    expect(VAT_RATE_BP).toBe(750);
    expect(addVAT(N(10000))).toEqual({ netKobo: N(10000), vatKobo: N(750), grossKobo: N(10750) });
  });

  it('removes VAT from a VAT-inclusive amount', () => {
    expect(removeVAT(N(10750))).toEqual({ netKobo: N(10000), vatKobo: N(750), grossKobo: N(10750) });
  });

  it('net + vat always equals gross, and add/remove round-trip (property check)', () => {
    for (let net = 0; net < 20000; net += 1) {
      const added = addVAT(net);
      expect(added.netKobo + added.vatKobo).toBe(added.grossKobo);
      const removed = removeVAT(added.grossKobo);
      expect(removed.netKobo + removed.vatKobo).toBe(removed.grossKobo);
      expect(removed.netKobo).toBe(net);
    }
  });

  it('rejects bad input', () => {
    expect(() => addVAT(10.5)).toThrow(TypeError);
    expect(() => removeVAT(-1)).toThrow(TypeError);
  });
});

describe('calculatePAYE (Nigeria Tax Act 2025 bands)', () => {
  it('is zero at or below ₦800,000', () => {
    expect(calculatePAYE({ annualGrossKobo: N(800000) }).annualTaxKobo).toBe(0);
    expect(calculatePAYE({ annualGrossKobo: 0 }).annualTaxKobo).toBe(0);
  });

  it.each([
    [3000000, 330000], // 15% of the 2.2m above 800k
    [12000000, 330000 + 1620000], // + 18% of 9m
    [25000000, 330000 + 1620000 + 2730000], // + 21% of 13m
    [50000000, 330000 + 1620000 + 2730000 + 5750000], // + 23% of 25m
    [60000000, 330000 + 1620000 + 2730000 + 5750000 + 2500000], // + 25% of 10m
  ])('₦%p gross, no deductions -> ₦%p', (gross, tax) => {
    expect(calculatePAYE({ annualGrossKobo: N(gross) }).annualTaxKobo).toBe(N(tax));
  });

  it('applies pension and rent relief before the bands', () => {
    const r = calculatePAYE({
      annualGrossKobo: N(12000000),
      pensionKobo: N(960000),
      annualRentKobo: N(2000000),
    });
    expect(r.rentReliefKobo).toBe(N(400000)); // 20% of ₦2m, under the ₦500k cap
    expect(r.taxableIncomeKobo).toBe(N(12000000 - 960000 - 400000));
    expect(r.annualTaxKobo).toBe(170520000); // ₦330,000 + 18% of ₦7,640,000 = ₦1,705,200
  });

  it('caps rent relief at ₦500,000', () => {
    const r = calculatePAYE({ annualGrossKobo: N(10000000), annualRentKobo: N(8000000) });
    expect(r.rentReliefKobo).toBe(N(500000));
  });

  it('never lets taxable income go negative', () => {
    const r = calculatePAYE({ annualGrossKobo: N(500000), pensionKobo: N(900000) });
    expect(r.taxableIncomeKobo).toBe(0);
    expect(r.annualTaxKobo).toBe(0);
  });

  it('band breakdown adds up to the total and covers the taxable income', () => {
    const r = calculatePAYE({ annualGrossKobo: N(60000000) });
    expect(r.bands.reduce((a, b) => a + b.taxKobo, 0)).toBe(r.annualTaxKobo);
    expect(r.bands.reduce((a, b) => a + b.taxableKobo, 0)).toBe(r.taxableIncomeKobo);
    expect(r.bands).toHaveLength(6);
    expect(r.bands[5].toKobo).toBeNull();
  });

  it('reports monthly tax and effective rate', () => {
    const r = calculatePAYE({ annualGrossKobo: N(3000000) });
    expect(r.monthlyTaxKobo).toBe(N(27500));
    expect(r.effectiveRateBp).toBe(1100); // 11.00%
  });

  it('tax never decreases as income rises (property check)', () => {
    let prev = 0;
    for (let g = 0; g <= N(80000000); g += N(137000) + 7) {
      const tax = calculatePAYE({ annualGrossKobo: g }).annualTaxKobo;
      expect(tax).toBeGreaterThanOrEqual(prev);
      prev = tax;
    }
  });

  it('is exact for very large incomes', () => {
    const r = calculatePAYE({ annualGrossKobo: N(5e12) });
    expect(Number.isSafeInteger(r.annualTaxKobo)).toBe(true);
    expect(r.annualTaxKobo).toBeGreaterThan(0);
  });

  it('rejects bad input', () => {
    expect(() => calculatePAYE({ annualGrossKobo: -1 })).toThrow(TypeError);
    expect(() => calculatePAYE({ annualGrossKobo: 1.5 })).toThrow(TypeError);
    expect(() => calculatePAYE({ annualGrossKobo: 100, pensionKobo: -5 })).toThrow(TypeError);
  });
});

describe('createPayeRule', () => {
  it('allows testing a different rent-relief cap', () => {
    const rule = createPayeRule({ ...NTA_2025_PAYE, id: 'alt', rentReliefCapKobo: N(200000) });
    const r = calculatePAYE({ annualGrossKobo: N(10000000), annualRentKobo: N(8000000) }, rule);
    expect(r.rentReliefKobo).toBe(N(200000));
  });

  it('requires an open-ended last band and valid rates', () => {
    expect(() =>
      createPayeRule({ ...NTA_2025_PAYE, bands: [{ widthKobo: 100, rateBp: 100 }] })
    ).toThrow(RangeError);
    expect(() =>
      createPayeRule({ ...NTA_2025_PAYE, bands: [{ widthKobo: null, rateBp: 20000 }] })
    ).toThrow(RangeError);
  });

  it('ships the NTA 2025 rule as frozen, dated, sourced data', () => {
    expect(Object.isFrozen(NTA_2025_PAYE)).toBe(true);
    expect(NTA_2025_PAYE.effectiveFrom).toBe('2026-01-01');
    expect(NTA_2025_PAYE.rentReliefCapKobo).toBe(N(500000));
  });
});
