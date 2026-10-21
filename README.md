# react-native-naira-utils


[![CI](https://github.com/okewunmi/npm-react-native-naira-utils/actions/workflows/ci.yml/badge.svg)](https://github.com/okewunmi/npm-react-native-naira-utils/actions/workflows/ci.yml)


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
import { formatNaira, formatKobo, parseNaira, toKobo, fromKobo } from 'react-native-naira-utils';

formatNaira(1000);                          // "₦1,000.00"
formatNaira(1000, { showKobo: false });     // "₦1,000"
formatNaira(1250000, { abbreviate: true }); // "₦1.25m"
formatNaira(-500);                          // "-₦500.00"
formatNaira(999999, { abbreviate: true });  // "₦999.99k"  (truncated: never overstates)
formatNaira(1999.99, { showKobo: false });  // "₦1,999"    (truncated, never rounded up)
formatNaira(1999.99, { showKobo: false, rounding: 'round' }); // "₦2,000" (opt-in)
formatKobo(120050);                         // "₦1,200.50"  (integer kobo, e.g. from a webhook)

parseNaira('₦1,200.50');                    // 1200.5
parseNaira('₦-500');                        // -500
parseNaira('1.2m');                         // throws TypeError (strict by design)

// For payment APIs (Paystack, Flutterwave, etc.) that require integer kobo:
toKobo(1200.5);   // 120050
toKobo(8.575);    // 858 (decimal-safe, no float drift)
toKobo(1.005, { rounding: 'strict' }); // throws RangeError: sub-kobo precision
fromKobo(120050); // 1200.5
```

All conversions use the number's decimal value and integer kobo, never
`amount * 100`, so there is no floating-point drift.

### Phone / network

```ts
import { isValidNGPhone, formatNGPhone, detectNetwork } from 'react-native-naira-utils';

isValidNGPhone('08031234567');    // true
isValidNGPhone('+2348031234567'); // true
isValidNGPhone('+234 (0) 803 123 4567'); // true

formatNGPhone('+2348031234567');                            // "08031234567"
formatNGPhone('08031234567', { format: 'international' });  // "+2348031234567"

detectNetwork('08031234567'); // "MTN"
detectNetwork('08041234567'); // "other" (smaller licensee)
```

Validation is structural (length and the 07/08/09 mobile range), so numbers on
newly allocated prefixes are not rejected. `detectNetwork` returns `'MTN' |
'Glo' | 'Airtel' | '9mobile' | 'other' | 'unknown'`.

> **Note:** `detectNetwork` is a best-effort heuristic based on original
> prefix allocations. Mobile Number Portability (MNP) means a number can
> be ported to a different network than its prefix suggests — don't rely
> on this for anything billing-critical.

### USSD

```ts
import { buildUSSD, dialUSSD } from 'react-native-naira-utils';

const code = buildUSSD('737', ['1', '1']); // "*737*1*1#"
await dialUSSD(code); // opens the native dialer pre-filled with the code
```

Params must be digits (`*` and `#` are rejected so a param can't change the
code's structure); pass `{ allowNonNumeric: true }` for letters. `dialUSSD`
pre-fills the dialer; it cannot read the network's response.

### Bank / NUBAN validation

```ts
import {
  isValidNUBAN,
  computeNUBANCheckDigit,
  isNUBANChecksumCompatible,
  guessBanks,
  getBankList,
} from 'react-native-naira-utils';

isValidNUBAN('0016563228', '058'); // true  (well-formed for GTBank)
isValidNUBAN('0016563229', '058'); // false (check digit mismatch)

computeNUBANCheckDigit('011', '000001457'); // 9

computeNUBANCheckDigit('50547', '000021457'); // 9  (5-digit OFI code)

guessBanks('0016563228'); // candidate banks, e.g. [{ code: '058', name: 'Guaranty Trust Bank' }, ...]

getBankList(); // ~40 Nigerian banks, MFBs, and fintechs (a frozen snapshot; returns a copy)
```

> **Note:** NUBAN validation confirms an account number is
> *mathematically well-formed*, not that the account exists or belongs to
> a specific person. For real account verification, use an online
> resolve-account-number API (e.g. Paystack, Flutterwave).
>
> `isValidNUBAN` and `guessBanks` follow the CBN's revised NUBAN standard
> (2020): 3-digit bank codes, 5-digit codes for other financial institutions
> (microfinance banks, fintechs) and 6-digit institution codes. Because the
> check is a single digit, roughly **1 in 10** random account numbers passes for
> any given bank, so `guessBanks` returns *candidates* to pre-select a bank
> picker, never proof of ownership. Some providers (OPay and PalmPay among
> them) issue account numbers that mirror the customer's phone number and do not
> pass the checksum; a failed check is not proof an account is invalid. The
> bundled bank list is a snapshot, so re-sync against a live provider list for
> production.

## Fintech toolkit (v0.3)

Everything below works in integer **kobo** (the unit Paystack/Flutterwave use)
with exact arithmetic. Format results with `formatKobo`.

### Exact money math

```ts
import { applyBasisPoints, splitKobo } from 'react-native-naira-utils';

applyBasisPoints(1_000_000, 750);   // 75000    (7.5% of ₦10,000 = ₦750)
splitKobo(10_000, 3);               // [3334, 3333, 3333]   sums exactly to ₦100
splitKobo(10_000, [50, 30, 20]);    // [5000, 3000, 2000]   weighted split
```

### Gateway fees and gross-up

```ts
import { calculateFee, grossUpForFee, PAYSTACK_LOCAL, formatKobo } from 'react-native-naira-utils';

calculateFee(PAYSTACK_LOCAL, 5_000_000);          // 85000   (₦850 on ₦50,000)
grossUpForFee(PAYSTACK_LOCAL, 100_000_000);
// { chargeKobo: 100200000, feeKobo: 200000, netKobo: 100000000 }
// To net ₦1,000,000 charge ₦1,002,000 (the ₦2,000 cap applies).
```

`grossUpForFee` finds the *smallest* charge that nets your target. The common
`(net + flat) / (1 - rate)` shortcut overcharges on large payments because it
ignores the cap. Rules are dated data with a `source`; build your own for
Flutterwave or a negotiated rate with `createFeeRule`:

```ts
const myRule = createFeeRule({
  id: 'my-rate', label: 'My negotiated rate', effectiveFrom: '2026-10-17',
  source: 'contract', percentBp: 140, flatKobo: 10000, capKobo: 200000,
});
```

Flutterwave's quoted fee excludes VAT, so its rules carry `vatExclusive: true`
and 7.5% VAT is added on the fee automatically:

```ts
import { FLUTTERWAVE_LOCAL, calculateFeeBreakdown } from 'react-native-naira-utils';

calculateFeeBreakdown(FLUTTERWAVE_LOCAL, 1_000_000);
// { baseFeeKobo: 20000, vatKobo: 1500, totalFeeKobo: 21500 }   (₦200 + ₦15 VAT on ₦10,000)
calculateFee(FLUTTERWAVE_LOCAL, 1_000_000, { includeVAT: false });  // 20000
```

Flutterwave's own pricing pages list no cap on the 2% local fee, although some
third-party sources still report the older ₦2,000 cap. If your agreement has
one: `createFeeRule({ ...FLUTTERWAVE_LOCAL, capKobo: 200000 })`.

> Fees are estimates. Provider pricing changes and differs by merchant, and
> Paystack does not document how it rounds fractional kobo (expect ±1 kobo).
> Reconcile against settlement reports.

### Transfer stamp duty, VAT and PAYE

```ts
import { transferStampDuty, addVAT, removeVAT, calculatePAYE } from 'react-native-naira-utils';

transferStampDuty(5_000_000);                    // 5000  (₦50 on transfers of ₦10,000+, sender pays)
transferStampDuty(5_000_000, { salary: true });  // 0

addVAT(1_000_000);     // { netKobo: 1000000, vatKobo: 75000, grossKobo: 1075000 }
removeVAT(1_075_000);  // { netKobo: 1000000, vatKobo: 75000, grossKobo: 1075000 }

const paye = calculatePAYE({
  annualGrossKobo: 1_200_000_000,   // ₦12,000,000
  pensionKobo: 96_000_000,          // ₦960,000
  annualRentKobo: 200_000_000,      // ₦2,000,000
});
paye.annualTaxKobo;   // 170520000  (₦1,705,200)
paye.monthlyTaxKobo;
paye.bands;           // per-band breakdown
```

PAYE uses the Nigeria Tax Act 2025 bands in force from 1 Jan 2026 (0% on the
first ₦800,000, then 15/18/21/23/25%). Sources disagree on the rent-relief cap
(most say ₦500,000; one says ₦200,000), so verify against the gazetted Act and
override with `createPayeRule` if needed. These are **estimates, not tax
advice**.

### Withholding tax

```ts
import { calculateWHT } from 'react-native-naira-utils';

calculateWHT({ amountKobo: 100_000_000, category: 'professional-services', recipient: 'corporate' });
// { rateBp: 500, whtKobo: 5000000, netPayableKobo: 95000000, rateDoubledForMissingTin: false }

calculateWHT({ amountKobo: 100_000_000, category: 'professional-services',
               recipient: 'corporate', recipientHasTin: false });
// rate doubles to 10%: whtKobo 10000000
```

Rates come from the Deduction of Tax at Source (Withholding) Regulations 2024.
Pass the **VAT-exclusive** amount. If you are a small company you can declare
`payerIsSmallCompany: true` (no deduction below ₦2,000,000 for a vendor with a
TIN). The package never decides "small company" status for you, because the
threshold differs between sources and between the Regulations and the Nigeria
Tax Act 2025.

**Rent is deliberately not built in**: published analyses disagree on the rate
(5% in one reading of the schedule, 10% in others). Add it once you've
confirmed it:

```ts
const rule = createWhtRule({ ...WHT_2024, id: 'mine',
  rates: { ...WHT_2024.rates, rent: { corporateResident: 1000, corporateNonResident: 1000,
                                       individualResident: 1000, individualNonResident: 1000 } } });
calculateWHT({ amountKobo: 100_000_000, category: 'rent', recipient: 'corporate' }, rule);
```

Estimates only, not tax advice: confirm against the gazetted Regulations.

### Amount in words

```ts
import { nairaInWords } from 'react-native-naira-utils';

nairaInWords(100050);     // "One Thousand Naira, Fifty Kobo Only"
nairaInWords(125000000);  // "One Million, Two Hundred and Fifty Thousand Naira Only"
nairaInWords(105000, { only: false, casing: 'lower' }); // "one thousand and fifty naira"
```

### Masking and amount input

```ts
import { maskPhone, maskAccountNumber, formatNairaInput } from 'react-native-naira-utils';

maskPhone('+2348031234567');       // "0803****567"
maskAccountNumber('0016563228');   // "******3228"

// In a React Native TextInput:
<TextInput
  keyboardType="decimal-pad"
  value={text}
  onChangeText={(raw) => {
    const r = formatNairaInput(raw);   // { text: '1,234.5', kobo: 123450, exceeded: false }
    setText(r.text);
    setAmountKobo(r.kobo);
  }}
/>
```

Extra decimals are cut, not rounded, so the field never shows more than the user typed.

## Why this exists

Every Nigerian fintech/e-commerce React Native app ends up hand-rolling
Naira formatting, phone validation, USSD string building, and NUBAN
checksum validation from scratch. This package centralizes those small
but easy-to-get-wrong utilities in one dependency-light, Expo-friendly
package.

## License

MIT
