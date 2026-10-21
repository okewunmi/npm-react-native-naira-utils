/**
 * Withholding tax (WHT) estimator based on the Deduction of Tax at Source
 * (Withholding) Regulations 2024.
 *
 * Scope, deliberately narrow: only categories where the published analyses
 * agree are included. RENT is left out because sources conflict (one reading
 * of the schedule gives 5% for residents, others 10%); gaming, entertainment
 * and compensation-for-loss-of-employment are left out as niche. Use
 * `createWhtRule` to add what you have verified.
 *
 * Amounts are integer KOBO; pass the VAT-exclusive amount. This is an
 * ESTIMATE, not tax advice. Rely on the gazetted Regulations and your tax
 * adviser, since rates, exemptions and the definition of a "small company"
 * have shifted between the 2024 Regulations and the Nigeria Tax Act 2025.
 */
import { applyBasisPoints } from './arith';

export type WhtCategory =
  | 'dividend'
  | 'interest'
  | 'royalty'
  | 'professional-services' // commission, consultancy, technical, management, professional fees
  | 'supply-of-goods' // other than by the manufacturer
  | 'other-services' // services not specifically listed
  | 'construction-major' // roads, bridges, buildings, power plants
  | 'construction-other'
  | 'brokerage'
  | 'telecom-tower-services'
  | 'directors-fees';

/** Rates in basis points for each recipient type; null where the schedule gives no rate. */
export interface WhtRates {
  corporateResident: number | null;
  corporateNonResident: number | null;
  individualResident: number | null;
  individualNonResident: number | null;
}

export interface WhtRule {
  id: string;
  label: string;
  effectiveFrom: string;
  source: string;
  rates: Readonly<Record<string, WhtRates>>;
}

const r = (cr: number | null, cn: number | null, ir: number | null, inr: number | null): WhtRates =>
  Object.freeze({
    corporateResident: cr,
    corporateNonResident: cn,
    individualResident: ir,
    individualNonResident: inr,
  });

/**
 * Rates from the First Schedule of the 2024 Regulations as summarised by PwC
 * (July 2024) and cross-checked against other firms' analyses.
 */
export const WHT_2024: WhtRule = Object.freeze({
  id: 'wht-2024',
  label: 'Deduction of Tax at Source (Withholding) Regulations 2024',
  effectiveFrom: '2024-07-01',
  source:
    'PwC, Highlights of the Deduction at Source (Withholding) Regulations 2024 (July 2024); verify against the gazetted Regulations',
  rates: Object.freeze({
    dividend: r(1000, 1000, 1000, 1000),
    interest: r(1000, 1000, 1000, 1000),
    royalty: r(1000, 1000, 500, 500),
    'professional-services': r(500, 1000, 500, 1000),
    'supply-of-goods': r(200, null, 200, null),
    'other-services': r(200, 500, 200, 500),
    'construction-major': r(200, 500, 200, 500),
    'construction-other': r(500, 1000, 500, 1000),
    brokerage: r(500, 1000, 500, 1000),
    'telecom-tower-services': r(200, 500, 200, 500),
    'directors-fees': r(null, null, 1500, 2000),
  }),
});

export interface WhtInput {
  /** The payment, VAT-exclusive, in kobo. */
  amountKobo: number;
  category: WhtCategory | string;
  recipient: 'corporate' | 'individual';
  /** Default 'resident'. */
  residency?: 'resident' | 'nonResident';
  /**
   * Whether the recipient supplied a valid TIN. Default true. Without one the
   * Regulations require deduction at twice the rate. (The Regulations' wording
   * targets trading income; reports differ on passive income, and this
   * function doubles every category.)
   */
  recipientHasTin?: boolean;
  /**
   * Set when YOU (the payer) qualify as a small company under the rules in
   * force. A small-company payer need not deduct on a transaction below
   * ₦2,000,000 to a vendor with a valid TIN. The package does not decide
   * "small company" for you: the turnover threshold differs between sources
   * and between the 2024 Regulations and the Nigeria Tax Act 2025.
   */
  payerIsSmallCompany?: boolean;
}

export interface WhtResult {
  rateBp: number;
  whtKobo: number;
  /** amountKobo - whtKobo: what the recipient actually receives. */
  netPayableKobo: number;
  /** Set when no WHT applies, with the reason. */
  exemptReason?: 'small-company-payer';
  rateDoubledForMissingTin: boolean;
}

const SMALL_COMPANY_LIMIT_KOBO = 200000000; // ₦2,000,000

/** Estimate the tax to withhold on a payment. */
export function calculateWHT(input: WhtInput, rule: WhtRule = WHT_2024): WhtResult {
  const {
    amountKobo,
    category,
    recipient,
    residency = 'resident',
    recipientHasTin = true,
    payerIsSmallCompany = false,
  } = input;

  if (!Number.isSafeInteger(amountKobo) || amountKobo < 0) {
    throw new TypeError(`calculateWHT: amountKobo must be a non-negative integer, got ${amountKobo}`);
  }
  const rates = rule.rates[category];
  if (!rates) {
    throw new RangeError(
      `calculateWHT: unknown category "${category}" (rent is intentionally not built in: see the module notes)`
    );
  }
  const key =
    `${recipient}${residency === 'resident' ? 'Resident' : 'NonResident'}` as keyof WhtRates;
  const base = rates[key];
  if (base === null || base === undefined) {
    throw new RangeError(
      `calculateWHT: the schedule gives no "${category}" rate for a ${residency} ${recipient} recipient`
    );
  }

  if (payerIsSmallCompany && recipientHasTin && amountKobo < SMALL_COMPANY_LIMIT_KOBO) {
    return {
      rateBp: base,
      whtKobo: 0,
      netPayableKobo: amountKobo,
      exemptReason: 'small-company-payer',
      rateDoubledForMissingTin: false,
    };
  }

  const doubled = !recipientHasTin;
  const rateBp = doubled ? base * 2 : base;
  const whtKobo = applyBasisPoints(amountKobo, rateBp);
  return { rateBp, whtKobo, netPayableKobo: amountKobo - whtKobo, rateDoubledForMissingTin: doubled };
}

/** Build a custom rule, e.g. to add rent once you have confirmed the rate. */
export function createWhtRule(rule: WhtRule): WhtRule {
  for (const [category, rates] of Object.entries(rule.rates)) {
    for (const [who, bp] of Object.entries(rates)) {
      if (bp !== null && (!Number.isSafeInteger(bp) || bp < 0 || bp > 10000)) {
        throw new RangeError(`createWhtRule: ${category}.${who} must be null or an integer 0..10000 bp`);
      }
    }
  }
  return Object.freeze({ ...rule, rates: Object.freeze({ ...rule.rates }) });
}
