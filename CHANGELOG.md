# Changelog

## 0.4.0

### Added
- **Flutterwave fee rules:** `FLUTTERWAVE_LOCAL` (2% = 1.4% + 0.6% platform fee,
  effective 11 April 2025) and `FLUTTERWAVE_INTERNATIONAL` (4.8%), both with 7.5%
  VAT on the fee, as Flutterwave's pricing page states. No fee cap is modelled
  because Flutterwave's own pages list none, although some third-party sources
  still report the old ₦2,000 cap. Add one with
  `createFeeRule({ ...FLUTTERWAVE_LOCAL, capKobo: 200000 })` if your agreement has it.
- **VAT on fees:** `FeeRule.vatExclusive`, `FeeOptions.includeVAT` and
  `calculateFeeBreakdown()` (base fee, VAT, total). `calculateFee` and
  `grossUpForFee` include the VAT for VAT-exclusive rules by default. The cap
  applies to the base fee and VAT is charged on the capped fee.
- **Withholding tax:** `calculateWHT` and `WHT_2024` (Deduction of Tax at Source
  (Withholding) Regulations 2024): by category, corporate/individual recipient,
  resident/non-resident, double rate when the recipient has no TIN, and the
  small-company-payer exemption (declared by the caller; the package does not
  guess "small company" status). `createWhtRule` adds verified categories.
  **Rent is deliberately not built in**: published analyses disagree (5% vs 10%).

### Notes
- Paystack results are unchanged: those rules carry no VAT flag.

## 0.3.0

Adds a fintech toolkit. Everything new works in integer **kobo**, the unit
payment APIs use, with exact arithmetic (no floating-point drift, no overflow).
Rates and fees are dated, sourced *data*, so a change in law or pricing means a
new rule object rather than a new release.

### Added
- **Exact money math:** `applyBasisPoints(kobo, bp)` (7.5% = 750 bp) and
  `splitKobo(total, parts | weights)` (largest-remainder split that never
  creates or loses a kobo). Verified against a BigInt reference, including
  amounts where `kobo * rate` exceeds 2^53.
- **Fees:** `calculateFee`, `grossUpForFee`, `PAYSTACK_LOCAL`,
  `PAYSTACK_INTERNATIONAL`, `createFeeRule`. `grossUpForFee` returns the
  *smallest* charge that nets a target, handling the fee cap and the flat-fee
  waiver (which makes net non-monotonic around ₦2,500). The common
  `(net + flat) / (1 - rate)` shortcut ignores the cap and overcharges.
- **Stamp duty:** `transferStampDuty` and `TRANSFER_STAMP_DUTY` (₦50 on
  electronic transfers of ₦10,000+, paid by the sender, from 1 Jan 2026).
- **Tax estimators:** `addVAT` / `removeVAT` (7.5%) and `calculatePAYE` with the
  Nigeria Tax Act 2025 bands (`NTA_2025_PAYE`), band-by-band breakdown, rent
  relief, monthly figure and effective rate; `createPayeRule` for custom rules.
- **`nairaInWords(kobo)`:** "One Thousand, Two Hundred and Thirty-Four Naira,
  Fifty Kobo Only", with `only` and `casing` options. English only.
- **Masking:** `maskPhone`, `maskAccountNumber`.
- **`formatNairaInput(text)`:** live formatting for a `TextInput`, returning the
  display text and the amount in kobo. Framework-agnostic; no React dependency.

### Changed
- Display policy: money is **never rounded up for display**. `showKobo: false`
  and abbreviations truncate toward zero by default (`₦1,999.99` -> `₦1,999`,
  `₦999,999` -> `₦999.99k`); `rounding: 'round'` opts in to nearest-value.
  (An earlier 0.2.0 draft rounded `₦1,999.99` up to `₦2,000`; that was wrong.)

## 0.2.0

Correctness release. Several functions that handle money, phone numbers and
account numbers returned wrong values for edge-case input; those are fixed.
A few behaviours are intentionally stricter (marked **behaviour change**).

### Fixed: currency
- `parseNaira('₦-500')` returned `500` (sign lost); now `-500`.
- **behaviour change** `parseNaira` now throws a `TypeError` on input it used to
  mis-parse silently: `'1.2m'` (was `1.2`), `'12abc'` (was `12`), `'1.2.3'`,
  `'1,2,3'` (was `123`), `'1.200,50'` (was `1.2005`), `'1e3'`, trailing text.
  Accounting negatives `'(₦500)'` are now supported.
- `toKobo` no longer suffers float drift at half-kobo boundaries
  (`8.575` was `857`, now `858`; `1.255` was `125`, now `126`) and rounds
  negatives symmetrically (`-0.025` was `-2`, now `-3`). New
  `{ rounding: 'strict' }` option throws on sub-kobo precision.
- `toKobo` / `formatNaira` throw `RangeError` beyond the safe-integer range
  (`toKobo(1e17)` used to return an unsafe integer; `formatNaira(1e21)` used to
  return `"₦1e+21.undefined"`).
- **behaviour change** `fromKobo` throws on fractional kobo instead of rounding.
- Display policy made explicit: money is **never rounded up for display**. With
  `showKobo: false`, `formatNaira(1999.99)` shows `₦1,999` (truncated toward
  zero, as before). New `rounding: 'round'` option opts in to nearest-value
  rounding (`₦2,000`).
- `formatNaira(1.005)` was `₦1.00`; now `₦1.01`. The kobo level rounds
  half-up on the decimal value, which only matters for sub-kobo / float-noise
  inputs (`0.1 + 0.7` now shows `₦0.80`, not `₦0.79`).
- `abbreviate` produced `₦1000k` / `₦1000m` at tier boundaries. It now truncates
  (`999999` -> `₦999.99k`), so an abbreviation never overstates an amount and
  the boundary bug cannot occur. `rounding: 'round'` promotes tiers (`₦1m`).
  Trillions (`t`) added. All abbreviation math is integer-based.
- `formatNaira(-0.001)` printed `-₦0.00`; now `₦0.00`.

### Fixed: phone
- **behaviour change** `isValidNGPhone` is now structural (07/08/09 mobile range,
  correct length) instead of "prefix is in my table". Previously rejected valid
  numbers on `0911`, `0707`, `0702`, `0804`, `0709`.
- Accepts `+234 (0) 803 123 4567`, `+2340803…` and `00234…`.
- `detectNetwork`: added `0707`, `0911`, `07025/07026` (MTN); returns the new
  `'other'` value for Ntel / Multilinks / other licensee blocks.
  (**type change**: `NigerianNetwork` gains `'other'`.)

### Fixed: USSD
- **behaviour change** `buildUSSD` rejects params containing `*`, `#` or (by
  default) non-digits, and malformed codes such as `'#'`. Pass
  `{ allowNonNumeric: true }` to allow letters. `null` params no longer crash.
- `dialUSSD` checks `Linking.canOpenURL` and throws a clear error when the
  device has no dialer.

### Added
- NUBAN: support for 5-digit CBN OFI codes and 6-digit institution codes per the
  CBN revised standard (2020). Verified against both CBN worked examples and
  identical to the old algorithm for all 3-digit codes.
- `guessBanks(accountNumber)`: candidate banks for an account number.
- `formatKobo(kobo)`: format integer kobo (e.g. from a Paystack webhook).
- **behaviour change** `isNUBANChecksumCompatible` is now true for 5-digit codes too.
- `NIGERIAN_BANKS` is frozen; `getBankList()` / `getBankByCode()` return copies.

### Packaging
- Added `repository`, `homepage`, `bugs`; CI workflow; CI badge fixed to the
  real repository; `engines.node` raised to 18; 153 tests (was 54).
