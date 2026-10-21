/**
 * USSD helpers: building well-formed USSD strings and dialing them.
 *
 * Note: `dialUSSD` depends on React Native's `Linking` module. It's
 * imported lazily/optionally so this package remains usable in plain
 * Node/testing environments without React Native installed.
 *
 * Scope: `dialUSSD` opens the phone dialer pre-filled with the code. It
 * cannot read the network's USSD response (iOS never exposes it to apps,
 * and Android needs a native module plus CALL_PHONE / READ_PHONE_STATE).
 */

export interface BuildUSSDOptions {
  /**
   * Allow letters in params (digits only by default). `*` and `#` are never
   * allowed inside a param, because they would change the code's structure.
   */
  allowNonNumeric?: boolean;
}

/**
 * Build a USSD string from a base code and ordered params.
 *
 * buildUSSD('737')                    -> "*737#"
 * buildUSSD('737', ['1', '1'])        -> "*737*1*1#"
 * buildUSSD('*737#')                  -> "*737#"  (idempotent on already-formed codes)
 *
 * Throws a TypeError if the code or a param would produce a malformed or
 * structurally altered string (e.g. a param of "1*2" or "1#").
 */
export function buildUSSD(
  code: string,
  params: ReadonlyArray<string | number> | null = [],
  options: BuildUSSDOptions = {}
): string {
  if (typeof code !== 'string' || code.trim() === '') {
    throw new TypeError('buildUSSD: code must be a non-empty string');
  }

  // Strip a leading "*" run and trailing "#" run the caller may have included.
  const cleanCode = code.trim().replace(/^\*+/, '').replace(/#+$/, '');
  if (!/^\d+(\*\d+)*$/.test(cleanCode)) {
    throw new TypeError(`buildUSSD: "${code}" is not a valid USSD code (expected e.g. "737" or "*737*1#")`);
  }

  const paramPattern = options.allowNonNumeric ? /^[A-Za-z0-9]+$/ : /^\d+$/;
  const cleanParams = (params ?? [])
    .map((p) => String(p).trim())
    .filter((p) => p.length > 0)
    .map((p) => {
      if (!paramPattern.test(p)) {
        throw new TypeError(
          `buildUSSD: invalid param "${p}" (${options.allowNonNumeric ? 'letters and digits' : 'digits'} only; "*" and "#" are not allowed)`
        );
      }
      return p;
    });

  return `*${[cleanCode, ...cleanParams].join('*')}#`;
}

/**
 * Dial a USSD string using React Native's Linking API.
 *
 * Handles the platform-specific quirks of `tel:` URLs: `#` starts a URI
 * fragment, so it must be percent-encoded or the dialer truncates the code.
 * Checks `Linking.canOpenURL` first and throws a clear error on devices
 * with no telephony app (tablets, simulators).
 *
 * Usage:
 *   await dialUSSD(buildUSSD('737', ['1', '1'])); // opens dialer with *737*1*1#
 *
 * Requires `react-native` as a peer dependency to be installed in the
 * consuming app; this function will throw a clear error if it's not
 * available (e.g. if called from a plain Node script).
 */
export async function dialUSSD(ussdString: string): Promise<void> {
  if (typeof ussdString !== 'string' || !/^\*[\d*]+#$/.test(ussdString)) {
    throw new TypeError(
      `dialUSSD: "${ussdString}" doesn't look like a valid USSD string (expected format like "*737*1*1#")`
    );
  }

  let Linking: { openURL(url: string): Promise<unknown>; canOpenURL?(url: string): Promise<boolean> };
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    Linking = require('react-native').Linking;
  } catch {
    throw new Error(
      'dialUSSD: react-native is not available in this environment. ' +
        'This function must be called from within a React Native app.'
    );
  }

  const url = `tel:${ussdString.replace(/#/g, '%23')}`;

  if (typeof Linking.canOpenURL === 'function' && !(await Linking.canOpenURL(url))) {
    throw new Error(
      'dialUSSD: this device cannot open the phone dialer (no telephony app available). ' +
        'Show the code to the user instead.'
    );
  }

  await Linking.openURL(url);
}
