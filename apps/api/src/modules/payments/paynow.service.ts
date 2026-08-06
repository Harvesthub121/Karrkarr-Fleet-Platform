/**
 * PayNowService — builds a dynamic QR payload and renders it as a data-URI PNG.
 *
 * Each invoice gets a unique QR. The amount and invoiceNo are locked into the
 * QR so the customer's banking app pre-fills both, eliminating the most common
 * source of reconciliation errors in manual-verification leasing ops.
 *
 * `qrcode` package encodes to PNG at error-correction level M (15% recovery).
 */

import { Injectable } from '@nestjs/common';
import { PolicyService } from '../policy/policy.service';
import { buildPayNowPayload, POLICY_KEYS } from '@vida/shared';
// qrcode is a runtime dep we assume is installed; types via @types/qrcode
// import QRCode from 'qrcode';

@Injectable()
export class PayNowService {
  constructor(private readonly policy: PolicyService) {}

  /**
   * Generate a data-URI PNG string for display in the customer portal.
   * The QR encodes a dynamic payload (amount locked, reference = invoiceNo).
   */
  async generateInvoiceQr(
    invoiceNo: string,
    amountCents: bigint,
  ): Promise<string> {
    const uen = await this.policy.get(POLICY_KEYS.PAYNOW_UEN);
    const merchantName = await this.policy.get(POLICY_KEYS.PAYNOW_MERCHANT_NAME);

    const payload = buildPayNowPayload({
      uen: String(uen),
      merchantName: String(merchantName),
      amountCents,
      reference: invoiceNo,
      editable: false,
      expiryDate: new Date(Date.now() + 30 * 86_400_000),
    });

    // Dynamically import qrcode to avoid import-time failures in test environments
    const QRCode = await import('qrcode');
    const dataUri = await QRCode.default.toDataURL(payload, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      margin: 2,
      width: 300,
    });

    return dataUri;
  }

  /** Return the raw payload string (for verification / debug endpoint). */
  async generateInvoicePayload(
    invoiceNo: string,
    amountCents: bigint,
  ): Promise<string> {
    const uen = await this.policy.get(POLICY_KEYS.PAYNOW_UEN);
    const merchantName = await this.policy.get(POLICY_KEYS.PAYNOW_MERCHANT_NAME);

    return buildPayNowPayload({
      uen: String(uen),
      merchantName: String(merchantName),
      amountCents,
      reference: invoiceNo,
      editable: false,
    });
  }
}
