/**
 * SINGAPORE PAYNOW QR (SGQR / EMVCo) PAYLOAD BUILDER
 * ==================================================
 *
 * Generates a *dynamic* PayNow QR: the amount and the payment reference are
 * baked into the payload, so the customer's banking app pre-fills both. That
 * matters operationally — the single largest source of reconciliation pain in
 * manual-verification leasing operations is customers typing a wrong reference
 * or a round-number amount. A dynamic QR removes both failure modes.
 *
 * No bank integration, no gateway, no per-transaction fee. Just a correctly
 * formatted string rendered as a QR code.
 *
 * FORMAT: EMVCo Merchant Presented Mode. Every field is
 *   [2-digit ID][2-digit length][value]
 * and the whole payload is terminated with a CRC-16/CCITT-FALSE checksum.
 *
 * Reference: EMVCo MPM spec + ABS SGQR/PayNow specification.
 */

import { centsToDecimalString, type Cents } from './money';

export interface PayNowQrOptions {
  /** UEN for a corporate payee (Karrkarr), or mobile "+65XXXXXXXX". */
  uen: string;
  /** Displayed to the payer in their banking app. Uppercase, <= 25 chars. */
  merchantName: string;
  /** Amount in cents. Omit for a static "payer decides" QR. */
  amountCents?: Cents;
  /**
   * Payment reference shown to the payer AND returned in the bank statement.
   * Use the invoice number — this is what makes reconciliation possible.
   */
  reference: string;
  /**
   * false = payer may edit the amount. We set false for invoices so the
   * amount is locked to what is actually owed.
   */
  editable?: boolean;
  /** QR expiry (YYYYMMDD). Defaults to 30 days out. */
  expiryDate?: Date;
  /** Merchant city. Always Singapore for us. */
  merchantCity?: string;
}

/** Build one EMVCo TLV field. Length is 2 digits, zero-padded. */
function tlv(id: string, value: string): string {
  const len = value.length.toString().padStart(2, '0');
  if (value.length > 99) {
    throw new RangeError(`EMVCo field ${id} exceeds 99 chars: ${value.length}`);
  }
  return `${id}${len}${value}`;
}

/**
 * CRC-16/CCITT-FALSE: poly 0x1021, init 0xFFFF, no reflection, no final xor.
 * Getting this wrong produces a QR that scans but is rejected by every bank
 * app with an unhelpful error, so it is unit-tested against known payloads.
 */
export function crc16(input: string): string {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function yyyymmdd(d: Date): string {
  return [
    d.getFullYear(),
    (d.getMonth() + 1).toString().padStart(2, '0'),
    d.getDate().toString().padStart(2, '0'),
  ].join('');
}

/**
 * Sanitise a reference for PayNow: alphanumerics only (banks silently mangle
 * punctuation), uppercase, max 25 chars.
 */
export function sanitiseReference(ref: string): string {
  const cleaned = ref.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!cleaned) throw new RangeError(`Reference produced no valid characters: "${ref}"`);
  return cleaned.slice(0, 25);
}

/**
 * Build the full PayNow QR payload string. Render it with any QR encoder
 * (we use `qrcode` at error-correction level M) — the string IS the QR.
 */
export function buildPayNowPayload(options: PayNowQrOptions): string {
  const {
    uen,
    merchantName,
    amountCents,
    reference,
    editable = false,
    expiryDate,
    merchantCity = 'Singapore',
  } = options;

  if (!uen?.trim()) throw new RangeError('PayNow UEN is required');

  const expiry = expiryDate ?? new Date(Date.now() + 30 * 86_400_000);

  // ID 00: Payload format indicator — always "01"
  let payload = tlv('00', '01');

  // ID 01: Point of initiation. 11 = static (reusable), 12 = dynamic.
  // An invoice QR carries a fixed amount, so it is dynamic/single-use.
  payload += tlv('01', amountCents === undefined ? '11' : '12');

  // ID 26: Merchant Account Information — the PayNow-specific block
  const paynowBlock =
    tlv('00', 'SG.PAYNOW') +
    // 01: proxy type. 0 = mobile, 2 = UEN
    tlv('01', uen.startsWith('+') ? '0' : '2') +
    // 02: the proxy value itself
    tlv('02', uen) +
    // 03: amount editable. 0 = locked to the amount in field 54
    tlv('03', editable ? '1' : '0') +
    // 04: QR expiry date
    tlv('04', yyyymmdd(expiry));
  payload += tlv('26', paynowBlock);

  // ID 52: Merchant category code. 0000 = unspecified.
  payload += tlv('52', '0000');
  // ID 53: Currency, ISO 4217 numeric. 702 = SGD.
  payload += tlv('53', '702');

  // ID 54: Transaction amount, as a plain decimal string.
  if (amountCents !== undefined) {
    payload += tlv('54', centsToDecimalString(amountCents));
  }

  // ID 58: Country code
  payload += tlv('58', 'SG');
  // ID 59: Merchant name (what the payer sees)
  payload += tlv('59', merchantName.slice(0, 25));
  // ID 60: Merchant city
  payload += tlv('60', merchantCity.slice(0, 15));

  // ID 62: Additional data — 01 holds the bill/reference number
  payload += tlv('62', tlv('01', sanitiseReference(reference)));

  // ID 63: CRC. The checksum is computed over the payload INCLUDING the
  // "6304" header of the CRC field itself.
  payload += '6304';
  payload += crc16(payload);

  return payload;
}

/** Verify a payload's checksum — used in tests and by the QR debug endpoint. */
export function verifyPayNowPayload(payload: string): boolean {
  if (payload.length < 8) return false;
  const body = payload.slice(0, -4);
  const supplied = payload.slice(-4).toUpperCase();
  return crc16(body) === supplied;
}
