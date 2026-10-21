import { calculateWHT, createWhtRule, WHT_2024 } from '../src/withholding';

const N = (naira: number) => naira * 100;

describe('calculateWHT (2024 Regulations)', () => {
  it.each([
    ['professional-services', 'corporate', 'resident', 1000000, 50000],
    ['professional-services', 'individual', 'resident', 1000000, 50000],
    ['professional-services', 'corporate', 'nonResident', 1000000, 100000],
    ['supply-of-goods', 'corporate', 'resident', 500000, 10000],
    ['other-services', 'corporate', 'resident', 500000, 10000],
    ['other-services', 'individual', 'nonResident', 500000, 25000],
    ['construction-major', 'corporate', 'resident', 10000000, 200000],
    ['construction-other', 'corporate', 'resident', 10000000, 500000],
    ['brokerage', 'corporate', 'resident', 200000, 10000],
    ['telecom-tower-services', 'corporate', 'resident', 1000000, 20000],
    ['dividend', 'individual', 'resident', 100000, 10000],
    ['interest', 'corporate', 'resident', 100000, 10000],
    ['royalty', 'corporate', 'resident', 100000, 10000],
    ['royalty', 'individual', 'resident', 100000, 5000],
    ['directors-fees', 'individual', 'resident', 1000000, 150000],
    ['directors-fees', 'individual', 'nonResident', 1000000, 200000],
  ] as const)('%s, %s %s: ₦%p -> ₦%p withheld', (category, recipient, residency, amount, wht) => {
    const result = calculateWHT({ amountKobo: N(amount), category, recipient, residency });
    expect(result.whtKobo).toBe(N(wht));
    expect(result.netPayableKobo).toBe(N(amount) - N(wht));
    expect(result.rateDoubledForMissingTin).toBe(false);
  });

  it('defaults to a resident recipient with a TIN', () => {
    const r = calculateWHT({ amountKobo: N(1000000), category: 'professional-services', recipient: 'corporate' });
    expect(r).toMatchObject({ rateBp: 500, whtKobo: N(50000), netPayableKobo: N(950000) });
  });

  it('doubles the rate when the recipient has no TIN', () => {
    const r = calculateWHT({
      amountKobo: N(1000000), category: 'professional-services', recipient: 'corporate', recipientHasTin: false,
    });
    expect(r).toMatchObject({ rateBp: 1000, whtKobo: N(100000), rateDoubledForMissingTin: true });
  });

  it('a small-company payer need not deduct below ₦2m to a vendor with a TIN', () => {
    const base = { category: 'supply-of-goods', recipient: 'corporate', payerIsSmallCompany: true } as const;
    const under = calculateWHT({ ...base, amountKobo: N(1999999) });
    expect(under.whtKobo).toBe(0);
    expect(under.exemptReason).toBe('small-company-payer');
    expect(under.netPayableKobo).toBe(N(1999999));
    expect(calculateWHT({ ...base, amountKobo: N(2000000) }).whtKobo).toBe(N(40000));
    expect(calculateWHT({ ...base, amountKobo: N(100000), recipientHasTin: false }).whtKobo).toBe(N(4000));
  });

  it('does not exempt a payer who has not declared small-company status', () => {
    const r = calculateWHT({ amountKobo: N(100000), category: 'supply-of-goods', recipient: 'corporate' });
    expect(r.whtKobo).toBe(N(2000));
  });

  it('rent is intentionally not built in', () => {
    expect(() => calculateWHT({ amountKobo: 100, category: 'rent', recipient: 'corporate' })).toThrow(/rent/);
  });

  it('throws where the schedule gives no rate (non-resident supply of goods)', () => {
    expect(() =>
      calculateWHT({ amountKobo: 100, category: 'supply-of-goods', recipient: 'corporate', residency: 'nonResident' })
    ).toThrow(RangeError);
    expect(() =>
      calculateWHT({ amountKobo: 100, category: 'directors-fees', recipient: 'corporate' })
    ).toThrow(RangeError);
  });

  it('rejects bad amounts', () => {
    expect(() => calculateWHT({ amountKobo: -1, category: 'dividend', recipient: 'individual' })).toThrow(TypeError);
    expect(() => calculateWHT({ amountKobo: 1.5, category: 'dividend', recipient: 'individual' })).toThrow(TypeError);
  });

  it('withheld + net always equals the amount, and WHT never exceeds the amount (property check)', () => {
    for (let a = 0; a < 5000000; a += 12347) {
      const r = calculateWHT({ amountKobo: a, category: 'directors-fees', recipient: 'individual', recipientHasTin: false });
      expect(r.whtKobo + r.netPayableKobo).toBe(a);
      expect(r.whtKobo).toBeLessThanOrEqual(a);
    }
  });

  it('ships a frozen, dated, sourced rule', () => {
    expect(Object.isFrozen(WHT_2024)).toBe(true);
    expect(Object.isFrozen(WHT_2024.rates)).toBe(true);
    expect(WHT_2024.effectiveFrom).toBe('2024-07-01');
    expect(WHT_2024.source).toMatch(/PwC/);
    expect(Object.keys(WHT_2024.rates)).not.toContain('rent');
  });
});

describe('createWhtRule', () => {
  const rates = (bp: number | null) => ({
    corporateResident: bp, corporateNonResident: bp, individualResident: bp, individualNonResident: bp,
  });

  it('lets you add a category you have verified, e.g. rent', () => {
    const rule = createWhtRule({ ...WHT_2024, id: 'with-rent', rates: { ...WHT_2024.rates, rent: rates(1000) } });
    const r = calculateWHT({ amountKobo: N(1000000), category: 'rent', recipient: 'corporate' }, rule);
    expect(r.whtKobo).toBe(N(100000));
  });

  it('rejects invalid rates', () => {
    expect(() => createWhtRule({ ...WHT_2024, rates: { x: rates(-1) } })).toThrow(RangeError);
    expect(() => createWhtRule({ ...WHT_2024, rates: { x: rates(10001) } })).toThrow(RangeError);
    expect(() => createWhtRule({ ...WHT_2024, rates: { x: rates(1.5) } })).toThrow(RangeError);
  });
});
