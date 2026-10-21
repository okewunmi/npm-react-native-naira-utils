/**
 * Live formatting for a Naira amount typed into a text field.
 *
 * Framework-agnostic: call it from React Native's `onChangeText` and store
 * the returned `text` for display and `kobo` as the value.
 *
 *   const [text, setText] = useState('');
 *   <TextInput
 *     keyboardType="decimal-pad"
 *     value={text}
 *     onChangeText={(raw) => {
 *       const r = formatNairaInput(raw);
 *       setText(r.text);
 *       setAmountKobo(r.kobo);
 *     }}
 *   />
 *
 * Typed digits beyond the allowed decimals are cut, not rounded, so the
 * field never shows more than the user typed.
 */

export interface NairaInputOptions {
  /** Decimal digits allowed (0 for whole naira only). Default 2. */
  maxDecimals?: 0 | 1 | 2;
  /** Largest amount accepted, in kobo. Default: the largest safe amount. */
  maxKobo?: number;
}

export interface NairaInputResult {
  /** Formatted text to show, e.g. "1,234.5". No currency symbol. */
  text: string;
  /** The amount in integer kobo, or null while the field is empty. */
  kobo: number | null;
  /** True when input was cut because it exceeded the limit. */
  exceeded: boolean;
}

const MAX_SAFE_KOBO = Number.MAX_SAFE_INTEGER;

function withCommas(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function formatNairaInput(raw: string, options: NairaInputOptions = {}): NairaInputResult {
  const { maxDecimals = 2, maxKobo = MAX_SAFE_KOBO } = options;
  const text = typeof raw === 'string' ? raw : '';

  const dot = text.indexOf('.');
  const hasDot = dot !== -1 && maxDecimals > 0;
  const wholeRaw = (dot === -1 ? text : text.slice(0, dot)).replace(/\D/g, '');
  const fracRaw = hasDot ? text.slice(dot + 1).replace(/\D/g, '').slice(0, maxDecimals) : '';

  if (wholeRaw === '' && !hasDot) return { text: '', kobo: null, exceeded: false };

  let whole = wholeRaw.replace(/^0+(?=\d)/, '');
  if (whole === '') whole = '0';

  let exceeded = false;
  const safeWholeDigits = String(Math.floor(Math.min(maxKobo, MAX_SAFE_KOBO) / 100)).length;
  if (whole.length > safeWholeDigits) {
    whole = whole.slice(0, safeWholeDigits);
    exceeded = true;
  }

  let kobo = Number(whole) * 100 + Number(fracRaw.padEnd(2, '0'));
  let frac = fracRaw;
  let showDot = hasDot;

  if (kobo > maxKobo) {
    exceeded = true;
    kobo = maxKobo;
    whole = String(Math.floor(maxKobo / 100));
    const koboPart = maxKobo % 100;
    frac = koboPart === 0 ? '' : String(koboPart).padStart(2, '0').slice(0, maxDecimals).replace(/0+$/, '');
    showDot = frac !== '';
  }

  return {
    text: `${withCommas(whole)}${showDot ? `.${frac}` : ''}`,
    kobo,
    exceeded,
  };
}
