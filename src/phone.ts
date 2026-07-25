/**
 * Nigerian phone number utilities: validation, normalization, and
 * best-effort network (telco) detection based on public prefix ranges.
 *
 * IMPORTANT: Nigeria has Mobile Number Portability (MNP), meaning a
 * number can be ported to a different network than its original prefix
 * suggests. `detectNetwork` is a best-effort heuristic based on the
 * original prefix allocation, not a guaranteed-accurate lookup. For
 * anything billing-critical, confirm with the user or an authoritative
 * carrier-lookup API.
 */

export type NigerianNetwork = 'MTN' | 'Glo' | 'Airtel' | '9mobile' | 'unknown';

// Prefixes are matched against the local an 11-digit format, e.g. "0803..."
const NETWORK_PREFIXES: Record<Exclude<NigerianNetwork, 'unknown'>, string[]> = {
  MTN: [
    '0803', '0806', '0703', '0706', '0813', '0816', '0810', '0814',
    '0903', '0906', '0913', '0916', '0704',
  ],
  Glo: ['0805', '0807', '0705', '0815', '0811', '0905', '0915'],
  Airtel: [
    '0802', '0808', '0708', '0812', '0701', '0902', '0901', '0904',
    '0907', '0912',
  ],
  '9mobile': ['0809', '0817', '0818', '0908', '0909'],
};

/**
 * Normalize a Nigerian phone number to a canonical local format:
 * 11 digits starting with 0 (e.g. "08031234567").
 *
 * Accepts inputs like "+2348031234567", "2348031234567",
 * "08031234567", or with spaces/dashes: "0803 123 4567".
 * Returns null if the input cannot be normalized to a valid-looking
 * Nigerian mobile number.
 */
function toLocalDigits(input: string): string | null {
  if (typeof input !== 'string') return null;

  const digitsOnly = input.replace(/\D/g, '');

  if (digitsOnly.length === 11 && digitsOnly.startsWith('0')) {
    return digitsOnly;
  }
  if (digitsOnly.length === 13 && digitsOnly.startsWith('234')) {
    return `0${digitsOnly.slice(3)}`;
  }
  if (digitsOnly.length === 10 && !digitsOnly.startsWith('0')) {
    // e.g. "8031234567" missing the leading 0
    return `0${digitsOnly}`;
  }

  return null;
}

/**
 * Validate whether a string is a plausible Nigerian mobile number.
 * Checks length/prefix shape, not carrier existence.
 *
 * isValidNGPhone("08031234567")   -> true
 * isValidNGPhone("+2348031234567")-> true
 * isValidNGPhone("12345")         -> false
 */
export function isValidNGPhone(input: string): boolean {
  const local = toLocalDigits(input);
  if (!local) return false;

  // Nigerian mobile numbers: 0 + 3-digit prefix + 7-digit subscriber number.
  if (!/^0\d{10}$/.test(local)) return false;

  const prefix = local.slice(0, 4);
  const allPrefixes = Object.values(NETWORK_PREFIXES).flat();
  return allPrefixes.includes(prefix);
}

export interface FormatNGPhoneOptions {
  format?: 'local' | 'international';
}

/**
 * Format a Nigerian phone number into a canonical form.
 *
 * formatNGPhone("+2348031234567")                          -> "08031234567"
 * formatNGPhone("08031234567", { format: 'international' })-> "+2348031234567"
 *
 * Throws if the input isn't a recognizable Nigerian number.
 */
export function formatNGPhone(input: string, options: FormatNGPhoneOptions = {}): string {
  const local = toLocalDigits(input);
  if (!local) {
    throw new TypeError(`formatNGPhone: "${input}" is not a recognizable Nigerian phone number`);
  }

  const format = options.format ?? 'local';
  if (format === 'international') {
    return `+234${local.slice(1)}`;
  }
  return local;
}

/**
 * Best-effort detection of the original network operator for a Nigerian
 * mobile number, based on publicly allocated prefix ranges.
 *
 * Returns 'unknown' if the number is invalid or the prefix isn't in the
 * known table. See the module-level note about number portability.
 *
 * detectNetwork("08031234567") -> "MTN"
 */
export function detectNetwork(phone: string): NigerianNetwork {
  const local = toLocalDigits(phone);
  if (!local || !/^0\d{10}$/.test(local)) return 'unknown';

  const prefix = local.slice(0, 4);
  for (const [network, prefixes] of Object.entries(NETWORK_PREFIXES) as Array<
    [Exclude<NigerianNetwork, 'unknown'>, string[]]
  >) {
    if (prefixes.includes(prefix)) return network;
  }
  return 'unknown';
}
