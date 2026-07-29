# react-native-naira-utils


[![CI](https://github.com/okewunmi/react-native-naira-utils/actions/workflows/ci.yml/badge.svg)](https://github.com/okewunmi/react-native-naira-utils/actions/workflows/ci.yml)


Pure JS/TypeScript utilities for Nigerian React Native apps: Naira/kobo
currency formatting, phone/network detection, USSD helpers, and NUBAN
account number validation.

No native modules required — works out of the box with **Expo** and bare
React Native.

## Install

```bash
npm install react-native-naira-utils
```

## Usage

### Currency

```ts
import { formatNaira, parseNaira, toKobo, fromKobo } from 'react-native-naira-utils';

formatNaira(1000);                          // "₦1,000.00"
formatNaira(1000, { showKobo: false });     // "₦1,000"
formatNaira(1250000, { abbreviate: true }); // "₦1.25m"
formatNaira(-500);                          // "-₦500.00"

parseNaira('₦1,200.50');                    // 1200.5

// For payment APIs (Paystack, Flutterwave, etc.) that require integer kobo:
toKobo(1200.5);   // 120050
fromKobo(120050); // 1200.5
```

### Phone / network

```ts
import { isValidNGPhone, formatNGPhone, detectNetwork } from 'react-native-naira-utils';

isValidNGPhone('08031234567');    // true
isValidNGPhone('+2348031234567'); // true

formatNGPhone('+2348031234567');                            // "08031234567"
formatNGPhone('08031234567', { format: 'international' });  // "+2348031234567"

detectNetwork('08031234567'); // "MTN"
```

> **Note:** `detectNetwork` is a best-effort heuristic based on original
> prefix allocations. Mobile Number Portability (MNP) means a number can
> be ported to a different network than its prefix suggests — don't rely
> on this for anything billing-critical.

### USSD

```ts
import { buildUSSD, dialUSSD } from 'react-native-naira-utils';

const code = buildUSSD('737', ['1', '1']); // "*737*1*1#"
await dialUSSD(code); // opens the native dialer
```

### Bank / NUBAN validation

```ts
import {
  isValidNUBAN,
  computeNUBANCheckDigit,
  isNUBANChecksumCompatible,
  getBankList,
} from 'react-native-naira-utils';

isValidNUBAN('0016563228', '058'); // true  (well-formed for GTBank)
isValidNUBAN('0016563229', '058'); // false (check digit mismatch)

computeNUBANCheckDigit('011', '000001457'); // 9

getBankList(); // ~40 Nigerian banks, MFBs, and fintechs with NIP codes
```

> **Note:** NUBAN validation confirms an account number is
> *mathematically well-formed*, not that the account exists or belongs to
> a specific person. For real account verification, use an online
> resolve-account-number API (e.g. Paystack, Flutterwave).
>
> The bundled list mixes classic 3-digit CBN sort codes (e.g. `058` for
> GTBank) with newer 5-6 digit NIP institution codes used by many
> microfinance banks and fintechs (e.g. `50211` for Kuda, `999992` for
> OPay). The CBN checksum algorithm only applies to 3-digit codes — use
> `isNUBANChecksumCompatible(bank)` to check before calling
> `isValidNUBAN`. For production, periodically re-sync the list against a
> live provider source rather than relying on this bundled snapshot
> indefinitely.

## Why this exists

Every Nigerian fintech/e-commerce React Native app ends up hand-rolling
Naira formatting, phone validation, USSD string building, and NUBAN
checksum validation from scratch. This package centralizes those small
but easy-to-get-wrong utilities in one dependency-light, Expo-friendly
package.

## License

MIT
