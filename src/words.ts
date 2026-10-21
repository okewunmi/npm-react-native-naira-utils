/**
 * Amounts in words, for receipts, invoices and cheques.
 *
 * nairaInWords(100050) -> "One Thousand Naira, Fifty Kobo Only"
 *
 * English only. Uses British conventions: "and" before the final
 * sub-hundred part and inside hundreds ("One Million, Two Hundred and Fifty
 * Thousand", "One Thousand and Fifty").
 */

export interface NairaInWordsOptions {
  /** Append "Only", as on cheques. Default: true */
  only?: boolean;
  /** 'title' (default), 'sentence', 'upper' or 'lower'. */
  casing?: 'title' | 'sentence' | 'upper' | 'lower';
}

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen',
  'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const SCALES = ['', 'Thousand', 'Million', 'Billion', 'Trillion'];

function underHundred(n: number): string {
  if (n < 20) return ONES[n];
  const unit = n % 10;
  return `${TENS[Math.floor(n / 10)]}${unit ? `-${ONES[unit]}` : ''}`;
}

function underThousand(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (hundreds === 0) return underHundred(rest);
  return `${ONES[hundreds]} Hundred${rest ? ` and ${underHundred(rest)}` : ''}`;
}

function wholeNumberInWords(n: number): string {
  if (n === 0) return 'Zero';
  const groups: number[] = [];
  let rest = n;
  while (rest > 0) {
    groups.push(rest % 1000);
    rest = Math.floor(rest / 1000);
  }
  if (groups.length > SCALES.length) throw new RangeError('nairaInWords: amount is too large');

  const segments: string[] = [];
  for (let i = groups.length - 1; i >= 1; i--) {
    if (groups[i] > 0) segments.push(`${underThousand(groups[i])} ${SCALES[i]}`);
  }
  const low = groups[0];
  if (low > 0) {
    if (low < 100 && segments.length > 0) {
      return `${segments.join(', ')} and ${underHundred(low)}`;
    }
    segments.push(underThousand(low));
  }
  return segments.join(', ');
}

/** Convert an integer kobo amount to words. */
export function nairaInWords(kobo: number, options: NairaInWordsOptions = {}): string {
  if (!Number.isSafeInteger(kobo)) {
    throw new TypeError(`nairaInWords: kobo must be a safe integer, got ${kobo}`);
  }
  const { only = true, casing = 'title' } = options;
  const abs = Math.abs(kobo);
  const nairaPart = Math.floor(abs / 100);
  const koboPart = abs % 100;

  const pieces: string[] = [];
  if (nairaPart > 0 || koboPart === 0) pieces.push(`${wholeNumberInWords(nairaPart)} Naira`);
  if (koboPart > 0) pieces.push(`${underHundred(koboPart)} Kobo`);

  let text = pieces.join(', ');
  if (kobo < 0) text = `Minus ${text}`;
  if (only) text += ' Only';

  switch (casing) {
    case 'upper':
      return text.toUpperCase();
    case 'lower':
      return text.toLowerCase();
    case 'sentence':
      return text.charAt(0) + text.slice(1).toLowerCase();
    default:
      return text;
  }
}
