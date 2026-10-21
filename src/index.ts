export {
  formatNaira,
  parseNaira,
  toKobo,
  fromKobo,
  formatKobo,
  type FormatNairaOptions,
  type ToKoboOptions,
} from './currency';

export {
  isValidNGPhone,
  formatNGPhone,
  detectNetwork,
  type NigerianNetwork,
  type FormatNGPhoneOptions,
} from './phone';

export { buildUSSD, dialUSSD, type BuildUSSDOptions } from './ussd';

export {
  isValidNUBAN,
  computeNUBANCheckDigit,
  isNUBANChecksumCompatible,
  guessBanks,
  getBankByCode,
  getBankList,
  NIGERIAN_BANKS,
  type NigerianBank,
} from './bank';

export {
  applyBasisPoints,
  splitKobo,
  type KoboRounding,
} from './arith';

export {
  PAYSTACK_LOCAL,
  PAYSTACK_INTERNATIONAL,
  FLUTTERWAVE_LOCAL,
  FLUTTERWAVE_INTERNATIONAL,
  TRANSFER_STAMP_DUTY,
  createFeeRule,
  calculateFee,
  calculateFeeBreakdown,
  grossUpForFee,
  transferStampDuty,
  type FeeRule,
  type FeeOptions,
  type FeeBreakdown,
  type GrossUpResult,
  type StampDutyOptions,
} from './fees';

export {
  VAT_RATE_BP,
  NTA_2025_PAYE,
  addVAT,
  removeVAT,
  calculatePAYE,
  createPayeRule,
  type VATBreakdown,
  type PayeBand,
  type PayeRule,
  type PayeInput,
  type PayeBandResult,
  type PayeResult,
} from './tax';

export { nairaInWords, type NairaInWordsOptions } from './words';
export { maskPhone, maskAccountNumber, type MaskOptions } from './mask';
export { formatNairaInput, type NairaInputOptions, type NairaInputResult } from './input';

export {
  WHT_2024,
  calculateWHT,
  createWhtRule,
  type WhtCategory,
  type WhtRates,
  type WhtRule,
  type WhtInput,
  type WhtResult,
} from './withholding';
