/**
 * Nigerian bank utilities: NUBAN account number checksum validation and
 * a starter list of CBN-assigned bank codes.
 *
 * NUBAN check-digit algorithm, per the CBN specification
 * ("Revised Standards on Nigeria Uniform Bank Account Number"):
 *
 *   Format: ABC-DEFGHIJKL-M
 *     ABC        = 3-digit CBN bank code
 *     DEFGHIJKL  = 9-digit account serial number
 *     M          = check digit
 *
 *   1. Concatenate bank code (3 digits) + serial number (9 digits) = 12 digits
 *   2. Multiply each digit by its weight: [3,7,3,3,7,3,3,7,3,3,7,3]
 *   3. Sum the products
 *   4. remainder = sum % 10
 *   5. checkDigit = 10 - remainder (if remainder is 0, checkDigit = 0)
 *
 * IMPORTANT CAVEATS:
 * - This validates that an account number is *mathematically well-formed*
 *   for a given bank code. It does NOT confirm the account exists or
 *   belongs to a real person — that requires an online lookup (e.g. via
 *   Paystack/Flutterwave's resolve-account-number APIs).
 * - Some newer fintech/microfinance institutions issue account numbers
 *   under a different underlying bank code than their public brand
 *   (e.g. via a partner deposit money bank), so validation should
 *   generally be treated as advisory, not authoritative.
 * - The bank list below covers ~40 commercial banks, microfinance banks,
 *   and payment service providers. Bank codes are periodically added or
 *   changed by CBN/NIBSS; for production use, periodically re-sync
 *   against a live provider list (e.g. Paystack's /bank endpoint) rather
 *   than hardcoding indefinitely.
 * - Codes come in two shapes: classic 3-digit CBN sort codes (e.g. "058"
 *   for GTBank), and newer 5-6 digit NIP institution codes used by many
 *   microfinance banks and fintechs (e.g. "50211" for Kuda, "999992" for
 *   OPay). The checksum algorithm above is defined by CBN specifically
 *   for 3-digit codes — `isNUBANChecksumCompatible` tells you which
 *   entries that applies to. For 5-6 digit codes, don't rely on
 *   `isValidNUBAN`; use an online resolve-account-number API instead.
 */

const NUBAN_WEIGHTS = [3, 7, 3, 3, 7, 3, 3, 7, 3, 3, 7, 3];

export interface NigerianBank {
  code: string;
  name: string;
}

/**
 * List of Nigerian banks, microfinance banks, and payment service
 * providers with their NIP institution codes. Not exhaustive — treat as
 * a convenience default, and prefer syncing against a live provider list
 * for production use.
 */
export const NIGERIAN_BANKS: NigerianBank[] = [
  { code: '044', name: 'Access Bank' },
  { code: '063', name: 'Access Bank (Diamond)' },
  { code: '035A', name: 'ALAT by WEMA' },
  { code: '401', name: 'ASO Savings and Loans' },
  { code: '50931', name: 'Bowen Microfinance Bank' },
  { code: '50823', name: 'CEMCS Microfinance Bank' },
  { code: '023', name: 'Citibank Nigeria' },
  { code: '050', name: 'Ecobank Nigeria' },
  { code: '562', name: 'Ekondo Microfinance Bank' },
  { code: '070', name: 'Fidelity Bank' },
  { code: '011', name: 'First Bank of Nigeria' },
  { code: '214', name: 'First City Monument Bank' },
  { code: '00103', name: 'Globus Bank' },
  { code: '058', name: 'Guaranty Trust Bank' },
  { code: '50383', name: 'Hasal Microfinance Bank' },
  { code: '030', name: 'Heritage Bank' },
  { code: '301', name: 'Jaiz Bank' },
  { code: '082', name: 'Keystone Bank' },
  { code: '50211', name: 'Kuda Bank' },
  { code: '303', name: 'Lotus Bank' },
  { code: '50515', name: 'Moniepoint MFB' },
  { code: '565', name: 'One Finance' },
  { code: '999992', name: 'OPay' },
  { code: '327', name: 'Paga' },
  { code: '999991', name: 'PalmPay' },
  { code: '526', name: 'Parallex Bank' },
  { code: '076', name: 'Polaris Bank' },
  { code: '101', name: 'Providus Bank' },
  { code: '125', name: 'Rubies MFB' },
  { code: '51310', name: 'Sparkle Microfinance Bank' },
  { code: '221', name: 'Stanbic IBTC Bank' },
  { code: '068', name: 'Standard Chartered Bank' },
  { code: '232', name: 'Sterling Bank' },
  { code: '100', name: 'Suntrust Bank' },
  { code: '302', name: 'TAJ Bank' },
  { code: '51211', name: 'TCF MFB' },
  { code: '102', name: 'Titan Trust Bank' },
  { code: '032', name: 'Union Bank of Nigeria' },
  { code: '033', name: 'United Bank For Africa' },
  { code: '215', name: 'Unity Bank' },
  { code: '566', name: 'VFD' },
  { code: '035', name: 'Wema Bank' },
  { code: '057', name: 'Zenith Bank' },
];

/**
 * Whether a bank's code follows the classic 3-digit CBN sort-code format
 * that `isValidNUBAN` / `computeNUBANCheckDigit` are defined for. Banks
 * with 5-6 digit NIP institution codes (many MFBs and fintechs) return
 * false here — checksum validation doesn't apply to them the same way.
 */
export function isNUBANChecksumCompatible(bank: NigerianBank): boolean {
  return /^\d{3}$/.test(bank.code);
}

/**
 * Compute the NUBAN check digit for a given 3-digit bank code and
 * 9-digit account serial number.
 *
 * computeNUBANCheckDigit('011', '000001457') -> 9
 */
export function computeNUBANCheckDigit(bankCode: string, serialNumber: string): number {
  if (!/^\d{3}$/.test(bankCode)) {
    throw new TypeError(`computeNUBANCheckDigit: bankCode must be exactly 3 digits, got "${bankCode}"`);
  }
  if (!/^\d{9}$/.test(serialNumber)) {
    throw new TypeError(
      `computeNUBANCheckDigit: serialNumber must be exactly 9 digits, got "${serialNumber}"`
    );
  }

  const digits = `${bankCode}${serialNumber}`.split('').map(Number);
  const sum = digits.reduce((total, digit, i) => total + digit * NUBAN_WEIGHTS[i], 0);
  const remainder = sum % 10;
  const checkDigit = remainder === 0 ? 0 : 10 - remainder;

  return checkDigit;
}

/**
 * Validate a 10-digit Nigerian NUBAN account number against a bank code
 * using the CBN check-digit algorithm.
 *
 * isValidNUBAN('0016563228', '058') -> true  (well-formed for GTBank)
 * isValidNUBAN('0016563229', '058') -> false (check digit mismatch)
 *
 * Returns false (rather than throwing) for malformed input, so it's
 * safe to use directly in form-validation logic.
 */
export function isValidNUBAN(accountNumber: string, bankCode: string): boolean {
  if (typeof accountNumber !== 'string' || !/^\d{10}$/.test(accountNumber)) return false;
  if (typeof bankCode !== 'string' || !/^\d{3}$/.test(bankCode)) return false;

  const serialNumber = accountNumber.slice(0, 9);
  const providedCheckDigit = Number(accountNumber[9]);

  try {
    const expectedCheckDigit = computeNUBANCheckDigit(bankCode, serialNumber);
    return expectedCheckDigit === providedCheckDigit;
  } catch {
    return false;
  }
}

/**
 * Look up a bank name from the starter bank list by its CBN code.
 * Returns undefined if not found in the bundled list.
 */
export function getBankByCode(code: string): NigerianBank | undefined {
  return NIGERIAN_BANKS.find((bank) => bank.code === code);
}

/**
 * Returns the bundled starter list of Nigerian banks.
 */
export function getBankList(): NigerianBank[] {
  return NIGERIAN_BANKS;
}
