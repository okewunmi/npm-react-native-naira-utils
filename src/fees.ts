/**
 * Payment-gateway fee and levy calculators. Rules are *data* (rate, flat
 * fee, cap, effective date, source) rather than hard-coded logic, so when a
 * provider changes pricing you swap or create a rule instead of waiting for a
 * package release.
 *
 * All amounts here are integer KOBO, the unit payment APIs use. Format them
 * for display with `formatKobo`. Fees are estimates: always reconcile against
 * the provider's settlement report.
 */
import { applyBasisPoints, type KoboRounding } from './arith';
import { VAT_RATE_BP } from './tax';

export interface FeeRule {
  id: string;
  label: string;
  /** ISO date the rule took effect or was last verified against the source. */
  effectiveFrom: string;
  /** Where the numbers came from. */
  source: string;
  /** Percentage in basis points (150 = 1.5%). */
  percentBp: number;
  /** Flat fee in kobo added to the percentage. */
  flatKobo: number;
  /** The flat fee is waived when the amount is below this (kobo). */
  flatWaivedBelowKobo?: number;
  /** The total fee never exceeds this (kobo). */
  capKobo?: number;
  /**
   * True when the provider's quoted fee excludes VAT, so 7.5% VAT is charged
   * on top of the (capped) fee. `calculateFee` adds it by default for such rules.
   */
  vatExclusive?: boolean;
}

export interface FeeOptions {
  /** Rounding of the fractional kobo in the percentage part. Default 'nearest'. */
  rounding?: KoboRounding;
  /**
   * Add 7.5% VAT on the fee. Defaults to the rule's `vatExclusive` flag; set
   * `false` to get the pre-VAT fee, or `true` to force VAT on any rule.
   */
  includeVAT?: boolean;
}

/**
 * Paystack, Nigerian local-channel transactions: 1.5% + ₦100, the ₦100 flat
 * fee waived under ₦2,500, total fee capped at ₦2,000.
 * Note the waiver covers the flat ₦100 only, not the 1.5% part.
 * Paystack does not document how it rounds fractional kobo; expect ±1 kobo.
 */
export const PAYSTACK_LOCAL: FeeRule = Object.freeze({
  id: 'paystack-ng-local',
  label: 'Paystack Nigeria, local transactions',
  effectiveFrom: '2026-10-17',
  source: 'https://support.paystack.com/en/articles/2130306',
  percentBp: 150,
  flatKobo: 10000,
  flatWaivedBelowKobo: 250000,
  capKobo: 200000,
});

/** Paystack, Nigerian international cards: 3.9% + ₦100, no cap. */
export const PAYSTACK_INTERNATIONAL: FeeRule = Object.freeze({
  id: 'paystack-ng-international',
  label: 'Paystack Nigeria, international cards',
  effectiveFrom: '2026-10-17',
  source: 'https://support.paystack.com/en/articles/2130306',
  percentBp: 390,
  flatKobo: 10000,
});

/**
 * Flutterwave, Nigerian local methods: 2% per transaction (a 1.4% transaction
 * fee plus a 0.6% platform fee, effective 11 April 2025), plus 7.5% VAT on the
 * fee, which Flutterwave's pricing page states.
 *
 * No cap is modelled because Flutterwave's own pricing pages list none, but
 * several third-party sources still report the older ₦2,000 cap. If your
 * merchant agreement has a cap, add it:
 *   createFeeRule({ ...FLUTTERWAVE_LOCAL, capKobo: 200000 })
 */
export const FLUTTERWAVE_LOCAL: FeeRule = Object.freeze({
  id: 'flutterwave-ng-local',
  label: 'Flutterwave Nigeria, local transactions',
  effectiveFrom: '2026-10-18',
  source: 'https://flutterwave.com/ng/pricing',
  percentBp: 200,
  flatKobo: 0,
  vatExclusive: true,
});

/** Flutterwave, Nigerian merchants, international cards: 4.8% plus 7.5% VAT on the fee. */
export const FLUTTERWAVE_INTERNATIONAL: FeeRule = Object.freeze({
  id: 'flutterwave-ng-international',
  label: 'Flutterwave Nigeria, international cards',
  effectiveFrom: '2026-10-18',
  source: 'https://flutterwave.com/ng/support/pricing/pricing-for-receiving-payment',
  percentBp: 480,
  flatKobo: 0,
  vatExclusive: true,
});

/**
 * Build your own rule, e.g. for Flutterwave or a negotiated rate. Pricing
 * changes over time and differs by merchant, so supply the figures you have
 * verified.
 */
export function createFeeRule(rule: FeeRule): FeeRule {
  const intFields: Array<[string, number | undefined]> = [
    ['percentBp', rule.percentBp],
    ['flatKobo', rule.flatKobo],
    ['flatWaivedBelowKobo', rule.flatWaivedBelowKobo],
    ['capKobo', rule.capKobo],
  ];
  for (const [name, value] of intFields) {
    if (value !== undefined && (!Number.isSafeInteger(value) || value < 0)) {
      throw new RangeError(`createFeeRule: ${name} must be a non-negative integer, got ${value}`);
    }
  }
  if (rule.percentBp >= 10000) throw new RangeError('createFeeRule: percentBp must be below 10000');
  return Object.freeze({ ...rule });
}

function assertAmount(amountKobo: number, fn: string): void {
  if (!Number.isSafeInteger(amountKobo) || amountKobo < 0) {
    throw new TypeError(`${fn}: amount must be a non-negative integer number of kobo, got ${amountKobo}`);
  }
}

export interface FeeBreakdown {
  /** The fee before VAT (percentage + flat, after waiver and cap). */
  baseFeeKobo: number;
  /** VAT charged on the fee (0 unless the rule is VAT-exclusive or `includeVAT` is set). */
  vatKobo: number;
  /** baseFeeKobo + vatKobo: what is actually deducted. */
  totalFeeKobo: number;
}

/** Fee split into its base and VAT parts. */
export function calculateFeeBreakdown(
  rule: FeeRule,
  amountKobo: number,
  options: FeeOptions = {}
): FeeBreakdown {
  assertAmount(amountKobo, 'calculateFee');
  const percent = applyBasisPoints(amountKobo, rule.percentBp, options.rounding ?? 'nearest');
  const flatWaived = rule.flatWaivedBelowKobo !== undefined && amountKobo < rule.flatWaivedBelowKobo;
  const uncapped = percent + (flatWaived ? 0 : rule.flatKobo);
  const baseFeeKobo = rule.capKobo !== undefined ? Math.min(uncapped, rule.capKobo) : uncapped;
  const withVat = options.includeVAT ?? rule.vatExclusive ?? false;
  const vatKobo = withVat ? applyBasisPoints(baseFeeKobo, VAT_RATE_BP) : 0;
  return { baseFeeKobo, vatKobo, totalFeeKobo: baseFeeKobo + vatKobo };
}

/**
 * Total fee in kobo that `rule` deducts on `amountKobo` (including VAT for
 * VAT-exclusive rules such as Flutterwave's; see `calculateFeeBreakdown`).
 */
export function calculateFee(rule: FeeRule, amountKobo: number, options: FeeOptions = {}): number {
  return calculateFeeBreakdown(rule, amountKobo, options).totalFeeKobo;
}

export interface GrossUpResult {
  /** What the customer must be charged. */
  chargeKobo: number;
  /** The fee that charge incurs. */
  feeKobo: number;
  /** What you receive: chargeKobo - feeKobo (>= the target; can exceed it by a kobo or two). */
  netKobo: number;
}

/**
 * "What must I charge so that I receive at least `targetNetKobo` after
 * fees?" Returns the *smallest* such charge.
 *
 * This is not just (net + flat) / (1 - rate): that ignores the fee cap
 * (overcharging customers on large payments) and the flat-fee waiver (which
 * makes the net amount non-monotonic around the waiver threshold, so the
 * smallest valid charge can sit just below it).
 */
export function grossUpForFee(
  rule: FeeRule,
  targetNetKobo: number,
  options: FeeOptions = {}
): GrossUpResult {
  assertAmount(targetNetKobo, 'grossUpForFee');
  const net = (charge: number) => charge - calculateFee(rule, charge, options);
  const rate = rule.percentBp / 10000;
  const waiveBelow = rule.flatWaivedBelowKobo ?? 0;

  const settle = (start: number, lowerBound: number): number => {
    let charge = Math.max(start, lowerBound);
    let guard = 0;
    while (net(charge) < targetNetKobo) {
      charge += 1;
      if (++guard > 100000) throw new RangeError('grossUpForFee: could not converge');
    }
    guard = 0;
    while (charge - 1 >= lowerBound && net(charge - 1) >= targetNetKobo) {
      charge -= 1;
      if (++guard > 100000) throw new RangeError('grossUpForFee: could not converge');
    }
    return charge;
  };

  let charge: number | undefined;

  // Region A: charges below the waiver threshold pay no flat fee. A charge there
  // can only reach the target when the plain 1/(1 - rate) estimate is itself
  // below the threshold (give or take rounding), so skip the search otherwise.
  if (waiveBelow > 0) {
    const guessA = Math.ceil(targetNetKobo / (1 - rate));
    if (guessA <= waiveBelow + 2) {
      const a = settle(guessA, 0);
      if (a < waiveBelow) charge = a;
    }
  }

  // Region B: charges at or above the threshold pay the flat fee (and may hit the cap).
  if (charge === undefined) {
    let guess = Math.ceil((targetNetKobo + rule.flatKobo) / (1 - rate));
    if (rule.capKobo !== undefined && calculateFee(rule, Math.max(guess, waiveBelow), options) >= rule.capKobo) {
      guess = targetNetKobo + rule.capKobo; // in the capped region net = charge - cap
    }
    charge = settle(guess, waiveBelow);
  }

  const feeKobo = calculateFee(rule, charge, options);
  return { chargeKobo: charge, feeKobo, netKobo: charge - feeKobo };
}

export interface StampDutyOptions {
  /** Salary payments are exempt. */
  salary?: boolean;
  /** Transfers between your own accounts within the same bank are exempt. */
  intraBankSelfTransfer?: boolean;
}

/**
 * Metadata for the electronic-transfer stamp duty. From 1 January 2026 the
 * Nigeria Tax Act 2025 replaced the EMTL with a flat ₦50 stamp duty on
 * electronic transfers of ₦10,000 and above, paid by the *sender*.
 * Exemptions reported in bank notices (UBA, First Bank, Jan 2026): transfers
 * below ₦10,000, salary payments, and intra-bank self-transfers. Confirm with
 * the Act or your bank before relying on edge cases.
 */
export const TRANSFER_STAMP_DUTY = Object.freeze({
  effectiveFrom: '2026-01-01',
  thresholdKobo: 1000000,
  amountKobo: 5000,
  paidBy: 'sender' as const,
  source: 'Nigeria Tax Act 2025; bank customer notices (UBA, First Bank), January 2026',
});

/** Stamp duty in kobo on an electronic transfer (0 when exempt). */
export function transferStampDuty(amountKobo: number, options: StampDutyOptions = {}): number {
  assertAmount(amountKobo, 'transferStampDuty');
  if (options.salary || options.intraBankSelfTransfer) return 0;
  return amountKobo >= TRANSFER_STAMP_DUTY.thresholdKobo ? TRANSFER_STAMP_DUTY.amountKobo : 0;
}
