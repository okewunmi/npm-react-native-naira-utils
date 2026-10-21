import {
  PAYSTACK_LOCAL,
  PAYSTACK_INTERNATIONAL,
  FLUTTERWAVE_LOCAL,
  FLUTTERWAVE_INTERNATIONAL,
  calculateFeeBreakdown,
  createFeeRule,
  calculateFee,
  grossUpForFee,
  transferStampDuty,
  TRANSFER_STAMP_DUTY,
} from '../src/fees';

const N = (naira: number) => naira * 100;

describe('calculateFee (Paystack local: 1.5% + ₦100, flat waived < ₦2,500, cap ₦2,000)', () => {
  it.each([
    [1000, 1500], // flat waived: 1.5% of ₦1,000 = ₦15
    [2499, 3749], // still waived (0.015 * 249900 = 3748.5 -> nearest 3749)
    [2500, 13750], // flat applies at exactly ₦2,500: ₦37.50 + ₦100
    [50000, 85000], // ₦750 + ₦100
    [133333, 200000], // reaches the cap
    [200000, 200000],
    [5000000, 200000],
  ])('₦%p -> %p kobo', (naira, fee) => {
    expect(calculateFee(PAYSTACK_LOCAL, N(naira))).toBe(fee);
  });

  it('the waiver covers only the flat ₦100, not the percentage', () => {
    expect(calculateFee(PAYSTACK_LOCAL, N(2000))).toBeGreaterThan(0);
  });

  it('international cards: 3.9% + ₦100, no cap', () => {
    expect(calculateFee(PAYSTACK_INTERNATIONAL, N(10000))).toBe(N(490)); // ₦390 + ₦100 flat
  });

  it('is monotone except for the single drop where the flat fee starts', () => {
    let prev = -1;
    for (let c = 0; c <= 600000; c += 1) {
      const fee = calculateFee(PAYSTACK_LOCAL, c);
      if (c !== 250000) expect(fee).toBeGreaterThanOrEqual(prev);
      prev = fee;
    }
  });

  it('rejects non-integer or negative kobo', () => {
    expect(() => calculateFee(PAYSTACK_LOCAL, 10.5)).toThrow(TypeError);
    expect(() => calculateFee(PAYSTACK_LOCAL, -1)).toThrow(TypeError);
  });

  it('rules are frozen data with provenance', () => {
    expect(Object.isFrozen(PAYSTACK_LOCAL)).toBe(true);
    expect(PAYSTACK_LOCAL.source).toMatch(/^https:\/\/support\.paystack\.com/);
    expect(PAYSTACK_LOCAL.effectiveFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('grossUpForFee', () => {
  it('reproduces the known cap case: to net ₦1,000,000 charge ₦1,002,000', () => {
    const r = grossUpForFee(PAYSTACK_LOCAL, N(1000000));
    expect(r).toEqual({ chargeKobo: N(1002000), feeKobo: N(2000), netKobo: N(1000000) });
  });

  it('does not use the naive (net + flat) / (1 - rate) formula, which ignores the cap', () => {
    const naive = Math.ceil((N(1000000) + 10000) / (1 - 0.015));
    expect(grossUpForFee(PAYSTACK_LOCAL, N(1000000)).chargeKobo).toBeLessThan(naive);
  });

  it('small amounts below the waiver need no flat fee', () => {
    const r = grossUpForFee(PAYSTACK_LOCAL, N(1000));
    expect(r.chargeKobo).toBeLessThan(250000);
    expect(r.netKobo).toBeGreaterThanOrEqual(N(1000));
  });

  it('is the SMALLEST charge that nets the target (exhaustive search, incl. around the waiver threshold)', () => {
    const rule = PAYSTACK_LOCAL;
    const targets: number[] = [];
    for (let t = 236000; t <= 262000; t += 97) targets.push(t); // straddles the ₦2,500 threshold
    for (let t = 1; t <= 600000; t += 7919) targets.push(t);
    for (const target of targets) {
      const r = grossUpForFee(rule, target);
      expect(r.netKobo).toBeGreaterThanOrEqual(target);
      let smallest = target;
      while (smallest - calculateFee(rule, smallest) < target) smallest += 1;
      expect(r.chargeKobo).toBe(smallest);
    }
  });

  it('works for a rule without a cap or waiver', () => {
    const r = grossUpForFee(PAYSTACK_INTERNATIONAL, N(10000));
    expect(r.netKobo).toBeGreaterThanOrEqual(N(10000));
    expect(r.netKobo).toBe(r.chargeKobo - r.feeKobo);
    expect(r.chargeKobo - 1 - calculateFee(PAYSTACK_INTERNATIONAL, r.chargeKobo - 1)).toBeLessThan(N(10000));
  });

  it('handles zero', () => {
    const r = grossUpForFee(PAYSTACK_LOCAL, 0);
    expect(r.netKobo).toBeGreaterThanOrEqual(0);
  });
});

describe('createFeeRule', () => {
  const base = {
    id: 'custom', label: 'Custom', effectiveFrom: '2026-10-17', source: 'contract',
    percentBp: 140, flatKobo: 0,
  };

  it('creates a frozen rule usable by the engine', () => {
    const rule = createFeeRule(base);
    expect(Object.isFrozen(rule)).toBe(true);
    expect(calculateFee(rule, N(10000))).toBe(N(140));
  });

  it('rejects invalid figures', () => {
    expect(() => createFeeRule({ ...base, percentBp: 1.5 })).toThrow(RangeError);
    expect(() => createFeeRule({ ...base, flatKobo: -1 })).toThrow(RangeError);
    expect(() => createFeeRule({ ...base, percentBp: 10000 })).toThrow(RangeError);
  });
});

describe('transferStampDuty (from 1 Jan 2026)', () => {
  it('charges ₦50 at or above ₦10,000', () => {
    expect(transferStampDuty(N(10000))).toBe(5000);
    expect(transferStampDuty(N(250000))).toBe(5000);
  });
  it('is zero below ₦10,000', () => {
    expect(transferStampDuty(999999)).toBe(0);
  });
  it('is zero for salary and intra-bank self transfers', () => {
    expect(transferStampDuty(N(500000), { salary: true })).toBe(0);
    expect(transferStampDuty(N(500000), { intraBankSelfTransfer: true })).toBe(0);
  });
  it('exposes the rule metadata', () => {
    expect(TRANSFER_STAMP_DUTY.paidBy).toBe('sender');
  });
});

describe('Flutterwave rules (2% local / 4.8% international, VAT on the fee)', () => {
  it('local: ₦10,000 -> ₦200 fee + ₦15 VAT', () => {
    expect(calculateFeeBreakdown(FLUTTERWAVE_LOCAL, N(10000))).toEqual({
      baseFeeKobo: N(200),
      vatKobo: N(15),
      totalFeeKobo: N(215),
    });
    expect(calculateFee(FLUTTERWAVE_LOCAL, N(10000))).toBe(N(215));
  });

  it('international: ₦10,000 -> ₦480 fee + ₦36 VAT', () => {
    expect(calculateFee(FLUTTERWAVE_INTERNATIONAL, N(10000))).toBe(N(516));
  });

  it('includeVAT: false returns the pre-VAT fee', () => {
    expect(calculateFee(FLUTTERWAVE_LOCAL, N(10000), { includeVAT: false })).toBe(N(200));
  });

  it('rules that are not VAT-exclusive get no VAT unless forced', () => {
    expect(calculateFeeBreakdown(PAYSTACK_LOCAL, N(50000)).vatKobo).toBe(0);
    const forced = calculateFeeBreakdown(PAYSTACK_LOCAL, N(50000), { includeVAT: true });
    expect(forced.vatKobo).toBe(Math.round(N(850) * 0.075));
  });

  it('has no cap by default (the official page lists none) but accepts one via createFeeRule', () => {
    expect(FLUTTERWAVE_LOCAL.capKobo).toBeUndefined();
    const capped = createFeeRule({ ...FLUTTERWAVE_LOCAL, capKobo: 200000 });
    expect(capped.vatExclusive).toBe(true);
    // The cap applies to the base fee; VAT is charged on the capped fee.
    expect(calculateFeeBreakdown(capped, N(5000000))).toEqual({
      baseFeeKobo: 200000,
      vatKobo: 15000,
      totalFeeKobo: 215000,
    });
  });

  it('breakdown parts always add up to the total (property check)', () => {
    for (let a = 0; a < 3000000; a += 9973) {
      const b = calculateFeeBreakdown(FLUTTERWAVE_LOCAL, a);
      expect(b.baseFeeKobo + b.vatKobo).toBe(b.totalFeeKobo);
    }
  });

  it('grossUpForFee is the smallest charge that nets the target, VAT included (exhaustive search)', () => {
    for (let target = 1; target <= 800000; target += 6007) {
      const r = grossUpForFee(FLUTTERWAVE_LOCAL, target);
      expect(r.netKobo).toBeGreaterThanOrEqual(target);
      let smallest = target;
      while (smallest - calculateFee(FLUTTERWAVE_LOCAL, smallest) < target) smallest += 1;
      expect(r.chargeKobo).toBe(smallest);
    }
  });

  it('provenance is attached', () => {
    expect(FLUTTERWAVE_LOCAL.source).toMatch(/^https:\/\/flutterwave\.com/);
    expect(Object.isFrozen(FLUTTERWAVE_LOCAL)).toBe(true);
  });
});
