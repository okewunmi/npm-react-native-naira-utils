/**
 * Nigerian phone number utilities: validation, normalization, and
 * best-effort network (telco) detection based on public prefix ranges.
 *
 * IMPORTANT: Nigeria has Mobile Number Portability (MNP, since 2013), meaning
 * a number can be ported to a different network than its original prefix
 * suggests. `detectNetwork` is a best-effort heuristic based on the
 * original prefix allocation, not a guaranteed-accurate lookup. For
 * anything billing-critical, confirm with the user or an authoritative
 * carrier-lookup API.
 *
 * Validation is deliberately *structural* (length + 07/08/09 mobile range),
 * not "is this prefix in my table": the NCC allocates new blocks over time
 * and a prefix table that gates validity would start rejecting real users.
 */

export type NigerianNetwork = 'MTN' | 'Glo' | 'Airtel' | '9mobile' | 'other' | 'unknown';

// Prefixes are matched against the local 11-digit format, e.g. "0803...".
// Source: NCC mobile number allocation table (Dec 2023) plus public
// operator listings. 9mobile is now commonly branded "T2".
const NETWORK_PREFIXES: Record<Exclude<NigerianNetwork, 'other' | 'unknown'>, string[]> = {
  MTN: [
    '0703', '0704', '0706', '0707', '0803', '0806', '0810', '0813',
    '0814', '0816', '0903', '0906', '0913', '0916',
  ],
  Glo: ['0705', '0805', '0807', '0811', '0815', '0905', '0915'],
  Airtel: [
    '0701', '0708', '0802', '0808', '0812', '0901', '0902', '0904',
    '0907', '0911', '0912',
  ],
  '9mobile': ['0809', '0817', '0818', '0908', '0909'],
};

// 07025/07026 are MTN (ex-Visafone); other 0702 blocks belong to other licensees.
const MTN_FIVE_DIGIT_PREFIXES = ['07025', '07026'];
// Allocated to other licensees (Ntel/M-Tel, Multilinks, a sub-range of 0801, rest of 0702).
const OTHER_PREFIXES = ['0702', '0709', '0801', '0804'];

/**
 * Normalize a Nigerian phone number to its 10-digit national significant
 * number (e.g. "8031234567"), or null if it can't be a mobile number.
 *
 * Accepts "+2348031234567", "2348031234567", "002348031234567",
 * "08031234567", "8031234567", "+234 (0) 803 123 4567", "0803-123-4567".
 */
function toNationalDigits(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  let d = input.replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('2340')) d = d.slice(4);
  else if (d.startsWith('234')) d = d.slice(3);
  else if (d.startsWith('0')) d = d.slice(1);
  // Mobile: 7/8/9, then 0 or 1, then 8 more digits.
  return /^[789][01]\d{8}$/.test(d) ? d : null;
}

/**
 * Validate whether a string is a plausible Nigerian mobile number.
 * Checks structure (length and mobile range), not carrier or existence.
 *
 * isValidNGPhone("08031234567")             -> true
 * isValidNGPhone("+234 (0) 803 123 4567")   -> true
 * isValidNGPhone("12345")                   -> false
 */
export function isValidNGPhone(input: string): boolean {
  return toNationalDigits(input) !== null;
}

export interface FormatNGPhoneOptions {
  /** 'local' -> "08031234567" (default); 'international' -> "+2348031234567" */
  format?: 'local' | 'international';
}

/**
 * Format a Nigerian phone number into a canonical form.
 *
 * formatNGPhone("+2348031234567")                          -> "08031234567"
 * formatNGPhone("08031234567", { format: 'international' })-> "+2348031234567"
 *
 * Throws if the input isn't a recognizable Nigerian mobile number.
 */
export function formatNGPhone(input: string, options: FormatNGPhoneOptions = {}): string {
  const national = toNationalDigits(input);
  if (!national) {
    throw new TypeError(`formatNGPhone: "${input}" is not a recognizable Nigerian phone number`);
  }
  return (options.format ?? 'local') === 'international' ? `+234${national}` : `0${national}`;
}

/**
 * Best-effort detection of the original network operator for a Nigerian
 * mobile number, based on publicly allocated prefix ranges.
 *
 * Returns 'other' for blocks held by smaller licensees (Ntel, Multilinks,
 * Smile...) and 'unknown' if the number is invalid or the prefix isn't in
 * the table. See the module-level note about number portability.
 *
 * detectNetwork("08031234567") -> "MTN"
 */
export function detectNetwork(phone: string): NigerianNetwork {
  const national = toNationalDigits(phone);
  if (!national) return 'unknown';
  const local = `0${national}`;

  if (MTN_FIVE_DIGIT_PREFIXES.some((p) => local.startsWith(p))) return 'MTN';
  const prefix = local.slice(0, 4);
  for (const [network, prefixes] of Object.entries(NETWORK_PREFIXES)) {
    if (prefixes.includes(prefix)) return network as NigerianNetwork;
  }
  return OTHER_PREFIXES.includes(prefix) ? 'other' : 'unknown';
}
