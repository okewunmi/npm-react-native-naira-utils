/**
 * USSD helpers: building well-formed USSD strings and dialing them.
 *
 * Note: `dialUSSD` depends on React Native's `Linking` module. It's
 * imported lazily/optionally so this package remains usable in plain
 * Node/testing environments without React Native installed.
 */

/**
 * Build a USSD string from a base code and ordered params.
 *
 * buildUSSD('737')                    -> "*737#"
 * buildUSSD('737', ['1', '1'])        -> "*737*1*1#"
 * buildUSSD('*737#')                  -> "*737#"  (idempotent on already-formed codes)
 */
export function buildUSSD(code: string, params: string[] = []): string {
  if (typeof code !== 'string' || code.trim() === '') {
    throw new TypeError('buildUSSD: code must be a non-empty string');
  }

  // Strip any leading/trailing * or # the caller may have already included,
  // so we can rebuild a clean, consistent string.
  const cleanCode = code.replace(/^\*+|\*+$/g, '').replace(/#/g, '');
  const cleanParams = params
    .map((p) => String(p).trim())
    .filter((p) => p.length > 0);

  const segments = [cleanCode, ...cleanParams].join('*');
  return `*${segments}#`;
}

/**
 * Dial a USSD string using React Native's Linking API.
 *
 * Handles the platform-specific quirks of `tel:` URLs with `*` and `#`:
 * both Android and iOS accept the raw USSD string in a `tel:` URL, but
 * `#` must be percent-encoded on some Android versions/launchers or the
 * dialer will truncate the string at the `#`.
 *
 * Usage:
 *   await dialUSSD(buildUSSD('737', ['1', '1'])); // dials *737*1*1#
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

  let Linking: { openURL: (url: string) => Promise<unknown> };
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    Linking = require('react-native').Linking;
  } catch {
    throw new Error(
      'dialUSSD: react-native is not available in this environment. ' +
        'This function must be called from within a React Native app.'
    );
  }

  // Percent-encode '#' as %23 for reliability across Android dialers,
  // while leaving '*' unencoded (widely supported unencoded).
  const encoded = ussdString.replace(/#/g, '%23');
  await Linking.openURL(`tel:${encoded}`);
}
