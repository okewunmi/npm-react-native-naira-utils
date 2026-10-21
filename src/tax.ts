/**
 * Nigerian VAT and PAYE estimators. Like the fee engine, the rates live in
 * dated rule objects, so a change in law means a new rule, not new code.
 *
 * All amounts are integer KOBO. These are ESTIMATES for display and
 * budgeting, not tax advice: payroll and filing must follow the gazetted Act
 * and the relevant tax authority's guidance.
 */
import { applyBasisPoints, mulDivKobo, type KoboRounding } from './arith';

/** VAT rate (7.5%) in basis points. Unchanged by the Nigeria Tax Act 2025. */
export const VAT_RATE_BP = 750;

export interface VATBreakdown {
  netKobo: number;
  vatKobo: number;
  grossKobo: number;
}

function assertKobo(value: number, name: string, fn: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${fn}: ${name} must be a non-negative integer number of kobo, got ${value}`);
  }
}

/** Add VAT to a VAT-exclusive amount. addVAT(1_000_000) -> net ₦10,000, vat ₦750, gross ₦10,750 */
export function addVAT(netKobo: number, rateBp: number = VAT_RATE_BP): VATBreakdown {
  assertKobo(netKobo, 'netKobo', 'addVAT');
  const vatKobo = applyBasisPoints(netKobo, rateBp);
  return { netKobo, vatKobo, grossKobo: netKobo + vatKobo };
}

/**
 * Split a VAT-inclusive amount into net and VAT. The VAT is computed from the
 * gross (gross * rate / (1 + rate)) so that net + vat always equals gross.
 */
export function removeVAT(
  grossKobo: number,
  rateBp: number = VAT_RATE_BP,
  rounding: KoboRounding = 'nearest'
): VATBreakdown {
  assertKobo(grossKobo, 'grossKobo', 'removeVAT');
  const vatKobo = mulDivKobo(grossKobo, rateBp, 10000 + rateBp, rounding);
  return { netKobo: grossKobo - vatKobo, vatKobo, grossKobo };
}

export interface PayeBand {
  /** Width of this band in kobo; null for the open-ended top band. */
  widthKobo: number | null;
  rateBp: number;
}

export interface PayeRule {
  id: string;
  label: string;
  effectiveFrom: string;
  source: string;
  bands: ReadonlyArray<PayeBand>;
  /** Rent relief: this share of annual rent (basis points)... */
  rentReliefRateBp: number;
  /** ...capped at this many kobo. */
  rentReliefCapKobo: number;
}

const naira = (n: number) => n * 100;

/**
 * Personal income tax under the Nigeria Tax Act 2025, effective 1 Jan 2026:
 * 0% on the first ₦800,000, then 15% (next ₦2.2m), 18% (next ₦9m), 21% (next
 * ₦13m), 23% (next ₦25m), 25% above ₦50m. The Consolidated Relief Allowance
 * is gone; rent relief is 20% of annual rent, capped at ₦500,000.
 *
 * Sources disagree on the rent-relief cap (most say ₦500,000, one says
 * ₦200,000). Verify against the gazetted Act, and use `createPayeRule` or the
 * `rentReliefCapKobo` override if it differs.
 */
export const NTA_2025_PAYE: PayeRule = Object.freeze({
  id: 'nta-2025-paye',
  label: 'Nigeria Tax Act 2025 PAYE (from 1 Jan 2026)',
  effectiveFrom: '2026-01-01',
  source: 'Nigeria Tax Act 2025 (Fourth Schedule); verify against the gazette and tax authority guidelines',
  bands: Object.freeze([
    { widthKobo: naira(800000), rateBp: 0 },
    { widthKobo: naira(2200000), rateBp: 1500 },
    { widthKobo: naira(9000000), rateBp: 1800 },
    { widthKobo: naira(13000000), rateBp: 2100 },
    { widthKobo: naira(25000000), rateBp: 2300 },
    { widthKobo: null, rateBp: 2500 },
  ]),
  rentReliefRateBp: 2000,
  rentReliefCapKobo: naira(500000),
});

export interface PayeInput {
  /** Annual gross emoluments, in kobo. */
  annualGrossKobo: number;
  /** Employee pension contribution for the year (deductible), in kobo. */
  pensionKobo?: number;
  /** National Housing Fund contribution for the year, in kobo. */
  nhfKobo?: number;
  /** Health insurance (NHIS) contribution for the year, in kobo. */
  nhisKobo?: number;
  /** Any other deduction you have established the law allows, in kobo. */
  otherDeductionsKobo?: number;
  /** Annual rent actually paid, in kobo (used for rent relief). */
  annualRentKobo?: number;
}

export interface PayeBandResult {
  fromKobo: number;
  toKobo: number | null;
  rateBp: number;
  taxableKobo: number;
  taxKobo: number;
}

export interface PayeResult {
  annualGrossKobo: number;
  deductionsKobo: number;
  rentReliefKobo: number;
  taxableIncomeKobo: number;
  annualTaxKobo: number;
  /** Annual tax / 12, nearest kobo. Employers may spread tax differently. */
  monthlyTaxKobo: number;
  /** Effective rate on gross, in basis points (rounded). */
  effectiveRateBp: number;
  bands: PayeBandResult[];
}

/** Estimate annual and monthly PAYE. Tax is computed band by band, each band rounded to the nearest kobo. */
export function calculatePAYE(input: PayeInput, rule: PayeRule = NTA_2025_PAYE): PayeResult {
  const {
    annualGrossKobo,
    pensionKobo = 0,
    nhfKobo = 0,
    nhisKobo = 0,
    otherDeductionsKobo = 0,
    annualRentKobo = 0,
  } = input;
  assertKobo(annualGrossKobo, 'annualGrossKobo', 'calculatePAYE');
  assertKobo(pensionKobo, 'pensionKobo', 'calculatePAYE');
  assertKobo(nhfKobo, 'nhfKobo', 'calculatePAYE');
  assertKobo(nhisKobo, 'nhisKobo', 'calculatePAYE');
  assertKobo(otherDeductionsKobo, 'otherDeductionsKobo', 'calculatePAYE');
  assertKobo(annualRentKobo, 'annualRentKobo', 'calculatePAYE');

  const deductionsKobo = pensionKobo + nhfKobo + nhisKobo + otherDeductionsKobo;
  const rentReliefKobo = Math.min(
    applyBasisPoints(annualRentKobo, rule.rentReliefRateBp, 'down'),
    rule.rentReliefCapKobo
  );
  const taxableIncomeKobo = Math.max(0, annualGrossKobo - deductionsKobo - rentReliefKobo);

  const bands: PayeBandResult[] = [];
  let remaining = taxableIncomeKobo;
  let cursor = 0;
  let annualTaxKobo = 0;
  for (const band of rule.bands) {
    const inBand = band.widthKobo === null ? remaining : Math.min(remaining, band.widthKobo);
    const taxKobo = applyBasisPoints(inBand, band.rateBp);
    bands.push({
      fromKobo: cursor,
      toKobo: band.widthKobo === null ? null : cursor + band.widthKobo,
      rateBp: band.rateBp,
      taxableKobo: inBand,
      taxKobo,
    });
    annualTaxKobo += taxKobo;
    remaining -= inBand;
    cursor += band.widthKobo ?? 0;
  }

  return {
    annualGrossKobo,
    deductionsKobo,
    rentReliefKobo,
    taxableIncomeKobo,
    annualTaxKobo,
    monthlyTaxKobo: mulDivKobo(annualTaxKobo, 1, 12),
    // Display statistic; floating point is fine here (and avoids overflow for huge incomes).
    effectiveRateBp: annualGrossKobo === 0 ? 0 : Math.round((annualTaxKobo / annualGrossKobo) * 10000),
    bands,
  };
}

/** Build a custom rule, e.g. to test a different rent-relief cap. */
export function createPayeRule(rule: PayeRule): PayeRule {
  if (rule.bands.length === 0 || rule.bands[rule.bands.length - 1].widthKobo !== null) {
    throw new RangeError('createPayeRule: the last band must be open-ended (widthKobo: null)');
  }
  rule.bands.forEach((b, i) => {
    if (!Number.isSafeInteger(b.rateBp) || b.rateBp < 0 || b.rateBp > 10000) {
      throw new RangeError(`createPayeRule: band ${i} rateBp must be an integer 0..10000`);
    }
    if (b.widthKobo !== null && (!Number.isSafeInteger(b.widthKobo) || b.widthKobo <= 0)) {
      throw new RangeError(`createPayeRule: band ${i} widthKobo must be a positive integer or null`);
    }
  });
  return Object.freeze({ ...rule, bands: Object.freeze([...rule.bands]) });
}
