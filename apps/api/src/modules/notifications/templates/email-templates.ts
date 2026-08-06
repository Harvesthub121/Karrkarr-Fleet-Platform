/**
 * HTML email templates for all transactional notification types.
 *
 * We use inline template strings rather than an external template engine
 * to keep the deployment simple (no extra files to bundle or find at runtime).
 * The style is inline CSS for maximum email-client compatibility.
 */

import type { NotificationPayload } from '../notification-channel.interface';

const BASE_STYLE = `
  font-family: Arial, Helvetica, sans-serif;
  max-width: 600px;
  margin: 0 auto;
  background: #ffffff;
`;

const HEADER_HTML = `
  <div style="background: #1a365d; padding: 24px; text-align: center;">
    <h1 style="color: #ffffff; margin: 0; font-size: 22px;">Karrkarr Pte Ltd</h1>
    <p style="color: #a0aec0; margin: 4px 0 0; font-size: 13px;">Fleet Leasing Management</p>
  </div>
`;

const FOOTER_HTML = `
  <div style="background: #f7fafc; padding: 16px; text-align: center; border-top: 1px solid #e2e8f0;">
    <p style="color: #718096; font-size: 12px; margin: 0;">
      Karrkarr Pte Ltd | support@karrkarr.com.sg | +65 6100 8888
    </p>
    <p style="color: #a0aec0; font-size: 11px; margin: 4px 0 0;">
      This is an automated notification. Please do not reply to this email.
    </p>
  </div>
`;

function wrap(body: string): string {
  return `<!DOCTYPE html><html><body style="${BASE_STYLE}">${HEADER_HTML}${body}${FOOTER_HTML}</body></html>`;
}

function contentBlock(title: string, paragraphs: string[], cta?: { text: string; url: string }): string {
  const ctaHtml = cta
    ? `<div style="text-align: center; margin: 24px 0;">
         <a href="${cta.url}" style="background: #2b6cb0; color: #fff; padding: 12px 28px; border-radius: 4px; text-decoration: none; font-size: 14px;">${cta.text}</a>
       </div>`
    : '';
  return `
    <div style="padding: 28px 32px;">
      <h2 style="color: #1a365d; font-size: 18px; margin: 0 0 16px;">${title}</h2>
      ${paragraphs.map((p) => `<p style="color: #4a5568; font-size: 14px; line-height: 1.6; margin: 0 0 12px;">${p}</p>`).join('')}
      ${ctaHtml}
    </div>
  `;
}

export function renderEmailTemplate(payload: NotificationPayload): string {
  const meta = payload.metadata ?? {};

  switch (payload.eventType) {
    case 'payment.reminder':
      return wrap(
        contentBlock(
          'Payment Reminder',
          [
            `Dear ${payload.recipientName ?? 'Valued Customer'},`,
            `This is a reminder that your invoice <strong>${meta.invoiceNo}</strong> for <strong>${meta.amountDisplay}</strong> is due on <strong>${meta.dueDate}</strong>.`,
            `Please arrange payment at your earliest convenience to avoid late interest charges.`,
            meta.qrDataUri ? `<img src="${meta.qrDataUri}" alt="PayNow QR" style="display:block;margin:16px auto;width:200px;" />` : '',
          ].filter(Boolean),
          payload.actionUrl ? { text: 'Pay Now', url: payload.actionUrl } : undefined,
        ),
      );

    case 'payment.submitted':
      return wrap(
        contentBlock(
          'Payment Submission Received',
          [
            `Dear Admin,`,
            `A customer has submitted a payment claim for invoice <strong>${meta.invoiceNo}</strong>.`,
            `<strong>Declared Amount:</strong> ${meta.amountDisplay}`,
            `<strong>Transaction Reference:</strong> ${meta.transactionRef}`,
            `Please review and verify this payment in the admin dashboard.`,
          ],
          payload.actionUrl ? { text: 'Review Payment', url: payload.actionUrl } : undefined,
        ),
      );

    case 'payment.approved':
      return wrap(
        contentBlock(
          'Payment Confirmed',
          [
            `Dear ${payload.recipientName ?? 'Valued Customer'},`,
            `Your payment of <strong>${meta.amountDisplay}</strong> for invoice <strong>${meta.invoiceNo}</strong> has been verified and confirmed.`,
            `<strong>Receipt Number:</strong> ${meta.receiptNo}`,
            `Thank you for your prompt payment.`,
          ],
          payload.actionUrl ? { text: 'View Receipt', url: payload.actionUrl } : undefined,
        ),
      );

    case 'payment.rejected':
      return wrap(
        contentBlock(
          'Payment Could Not Be Verified',
          [
            `Dear ${payload.recipientName ?? 'Valued Customer'},`,
            `Unfortunately, we were unable to verify your payment submission for invoice <strong>${meta.invoiceNo}</strong>.`,
            `<strong>Reason:</strong> ${meta.rejectionReason}`,
            `Please resubmit with the correct details, or contact us if you need assistance.`,
          ],
          payload.actionUrl ? { text: 'Resubmit Payment', url: payload.actionUrl } : undefined,
        ),
      );

    case 'vehicle.coe_expiring':
    case 'vehicle.road_tax_expiring':
    case 'vehicle.insurance_expiring':
    case 'vehicle.inspection_due':
      return wrap(
        contentBlock(
          `Vehicle Compliance Alert: ${payload.title}`,
          [
            `Dear Admin,`,
            `Vehicle <strong>${meta.plateNumber}</strong> (${meta.make} ${meta.model}) requires attention.`,
            `<strong>${meta.expiryType}</strong> expires on <strong>${meta.expiryDate}</strong> (${meta.daysBefore} days remaining).`,
            `Please arrange renewal before the expiry date to maintain compliance.`,
          ],
          payload.actionUrl ? { text: 'View Vehicle', url: payload.actionUrl } : undefined,
        ),
      );

    case 'rental.ending_soon':
      return wrap(
        contentBlock(
          'Rental Ending Soon',
          [
            `Dear Admin,`,
            `Rental agreement <strong>${meta.agreementNo}</strong> for customer <strong>${meta.customerName}</strong> is ending on <strong>${meta.endDate}</strong>.`,
            `Vehicle: ${meta.plateNumber}`,
            `Please follow up with the customer regarding renewal or return.`,
          ],
          payload.actionUrl ? { text: 'View Rental', url: payload.actionUrl } : undefined,
        ),
      );

    case 'risk.customer_high':
      return wrap(
        contentBlock(
          'High-Risk Customer Alert',
          [
            `Dear Admin,`,
            `Customer <strong>${meta.customerName}</strong> (${meta.customerRef}) has crossed the high-risk threshold with a risk score of <strong>${meta.riskScore}/100</strong>.`,
            `This may indicate payment issues requiring escalated follow-up.`,
          ],
          payload.actionUrl ? { text: 'View Collections', url: payload.actionUrl } : undefined,
        ),
      );

    default:
      // Generic fallback for any event type not explicitly templated
      return wrap(
        contentBlock(
          payload.title,
          [payload.body],
          payload.actionUrl ? { text: 'View Details', url: payload.actionUrl } : undefined,
        ),
      );
  }
}
