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
 * - Codes come in three shapes: classic 3-digit CBN sort codes (e.g. "058"
 *   for GTBank), 5-digit CBN codes for other financial institutions (OFIs,
 *   e.g. "50211" for Kuda), and 6-digit institution codes (the form the
 *   algorithm uses internally; some NIP/provider lists, such as "999992" for
 *   OPay, are also 6 digits but are NOT in that internal form).
 *   Per the CBN's revised NUBAN standard (2020), a 3-digit code is padded to
 *   "000XXX" and a 5-digit OFI code to "9XXXXX", and the check digit is
 *   computed over the 15 digits (6-digit code + 9-digit serial). This is
 *   identical to the original 12-digit algorithm for all 3-digit codes.
 *   Some fintechs (OPay, PalmPay and others) issue account numbers that mirror
 *   the customer's phone number and do not pass the checksum, so a failed
 *   check is not proof an account is invalid. Use an online
 *   resolve-account-number API for real verification.
 */

// 15 weights: 6-digit institution code + 9-digit account serial number.
const NUBAN_WEIGHTS = [3, 7, 3, 3, 7, 3, 3, 7, 3, 3, 7, 3, 3, 7, 3];

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
const BANKS: NigerianBank[] = [
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

/** The bundled bank list. Frozen: copy it before modifying. */
export const NIGERIAN_BANKS: ReadonlyArray<Readonly<NigerianBank>> = Object.freeze(
  BANKS.map((bank) => Object.freeze({ ...bank }))
);

/**
 * Normalize an institution code to the 6-digit form used by the NUBAN
 * algorithm: "011" -> "000011", "50211" -> "950211", "000011" unchanged.
 * Throws a TypeError for any other shape.
 */
function toSixDigitInstitutionCode(code: string, fn: string): string {
  if (typeof code === 'string') {
    if (/^\d{3}$/.test(code)) return `000${code}`;
    if (/^\d{5}$/.test(code)) return `9${code}`;
    if (/^\d{6}$/.test(code)) return code;
  }
  throw new TypeError(`${fn}: bankCode must be 3, 5 or 6 digits, got "${code}"`);
}

/**
 * Whether the CBN NUBAN checksum is defined for this bank's code: classic
 * 3-digit codes and 5-digit OFI codes. Non-numeric codes (e.g. "035A") and
 * 6-digit provider/NIP codes such as "999992" return false.
 *
 * "Compatible" means the check is defined, not that every account the
 * institution issues obeys it (see the notes at the top of this file).
 */
export function isNUBANChecksumCompatible(bank: Readonly<NigerianBank>): boolean {
  return /^(\d{3}|\d{5})$/.test(bank.code);
}

/**
 * Compute the NUBAN check digit for an institution code (3, 5 or 6 digits)
 * and a 9-digit account serial number.
 *
 * computeNUBANCheckDigit('011', '000001457')   -> 9  (DMB, CBN example)
 * computeNUBANCheckDigit('50547', '000021457') -> 9  (OFI, CBN example)
 */
export function computeNUBANCheckDigit(bankCode: string, serialNumber: string): number {
  const institution = toSixDigitInstitutionCode(bankCode, 'computeNUBANCheckDigit');
  if (typeof serialNumber !== 'string' || !/^\d{9}$/.test(serialNumber)) {
    throw new TypeError(
      `computeNUBANCheckDigit: serialNumber must be exactly 9 digits, got "${serialNumber}"`
    );
  }

  const digits = `${institution}${serialNumber}`.split('').map(Number);
  const sum = digits.reduce((total, digit, i) => total + digit * NUBAN_WEIGHTS[i], 0);
  return (10 - (sum % 10)) % 10;
}

/**
 * Validate a 10-digit Nigerian NUBAN account number against a bank code
 * using the CBN check-digit algorithm (3-, 5- and 6-digit codes).
 *
 * isValidNUBAN('0016563228', '058') -> true  (well-formed for GTBank)
 * isValidNUBAN('0016563229', '058') -> false (check digit mismatch)
 *
 * This is a typo detector, not an identifier: roughly 1 in 10 random
 * account numbers passes for any given bank. Returns false (rather than
 * throwing) for malformed input, so it's safe in form-validation logic.
 */
export function isValidNUBAN(accountNumber: string, bankCode: string): boolean {
  if (typeof accountNumber !== 'string' || !/^\d{10}$/.test(accountNumber)) return false;
  try {
    return (
      computeNUBANCheckDigit(bankCode, accountNumber.slice(0, 9)) === Number(accountNumber[9])
    );
  } catch {
    return false;
  }
}

/**
 * Candidate banks for an account number: every checksum-compatible bank
 * whose code makes the check digit valid. Use it to pre-select or narrow a
 * bank picker, never as proof of ownership: because the check is one digit,
 * expect several candidates (about 10% of banks match any random number)
 * and always confirm via a resolve-account-number API before paying.
 * Returns [] for malformed input.
 */
export function guessBanks(
  accountNumber: string,
  banks: ReadonlyArray<Readonly<NigerianBank>> = NIGERIAN_BANKS
): NigerianBank[] {
  if (typeof accountNumber !== 'string' || !/^\d{10}$/.test(accountNumber)) return [];
  return banks
    .filter((bank) => isNUBANChecksumCompatible(bank) && isValidNUBAN(accountNumber, bank.code))
    .map((bank) => ({ ...bank }));
}

/**
 * Look up a bank name from the starter bank list by its code.
 * Returns undefined if not found in the bundled list.
 */
export function getBankByCode(code: string): NigerianBank | undefined {
  const bank = NIGERIAN_BANKS.find((b) => b.code === code);
  return bank ? { ...bank } : undefined;
}

/**
 * Returns a copy of the bundled starter list of Nigerian banks.
 */
export function getBankList(): NigerianBank[] {
  return NIGERIAN_BANKS.map((bank) => ({ ...bank }));
}
