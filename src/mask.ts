/**
 * Masking for displaying sensitive numbers (receipts, confirmation screens,
 * logs). Masking hides digits from casual view; it is not encryption.
 */
import { formatNGPhone } from './phone';

export interface MaskOptions {
  /** Leading characters left visible. */
  visibleStart?: number;
  /** Trailing characters left visible. */
  visibleEnd?: number;
  /** Character used for hidden digits. Default '*' */
  maskChar?: string;
}

function mask(value: string, start: number, end: number, maskChar: string): string {
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < 0) {
    throw new RangeError('mask: visibleStart and visibleEnd must be non-negative integers');
  }
  if (start + end >= value.length) {
    throw new RangeError('mask: visibleStart + visibleEnd must be less than the number of digits');
  }
  return value.slice(0, start) + maskChar.repeat(value.length - start - end) + value.slice(value.length - end);
}

/**
 * Mask a Nigerian mobile number, shown in local format.
 * maskPhone('+2348031234567') -> "0803****567"
 * Throws a TypeError if the input is not a valid Nigerian mobile number.
 */
export function maskPhone(input: string, options: MaskOptions = {}): string {
  const { visibleStart = 4, visibleEnd = 3, maskChar = '*' } = options;
  return mask(formatNGPhone(input), visibleStart, visibleEnd, maskChar);
}

/**
 * Mask a 10-digit account number.
 * maskAccountNumber('0016563228') -> "******3228"
 */
export function maskAccountNumber(accountNumber: string, options: MaskOptions = {}): string {
  const { visibleStart = 0, visibleEnd = 4, maskChar = '*' } = options;
  if (typeof accountNumber !== 'string' || !/^\d{10}$/.test(accountNumber)) {
    throw new TypeError('maskAccountNumber: accountNumber must be exactly 10 digits');
  }
  return mask(accountNumber, visibleStart, visibleEnd, maskChar);
}
