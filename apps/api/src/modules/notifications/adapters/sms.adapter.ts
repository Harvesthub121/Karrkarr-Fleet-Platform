/**
 * SmsAdapter — INTENTIONALLY NOT WIRED. Interface stub.
 *
 * TO WIRE THIS UP you need:
 *   1. An SMS gateway account. Recommended for Singapore:
 *      - Twilio (global, easiest setup, ~S$0.08/SMS)
 *      - Vonage / Sinch as alternatives
 *      - For higher volume: Infobip has SG presence
 *   2. Set env vars: SMS_PROVIDER=twilio, TWILIO_ACCOUNT_SID,
 *      TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER.
 *   3. Install the Twilio SDK: `pnpm add twilio @types/twilio`.
 *   4. Replace the throw below with:
 *        const client = twilio(accountSid, authToken);
 *        await client.messages.create({ to: payload.recipientPhone, from, body: payload.body });
 *   5. Add `phone` (E.164) to NotificationPayload and populate it in
 *      NotificationService.notifyCustomer from Customer.phone.
 *
 * Note: Singapore PDPA requires opt-in consent for marketing SMS. Payment
 * reminders are transactional and are generally exempt, but confirm with legal.
 */

import { Injectable } from '@nestjs/common';
import { NotImplementedException } from '@nestjs/common';
import type { NotificationChannelAdapter, NotificationPayload, NotificationResult } from '../notification-channel.interface';

@Injectable()
export class SmsAdapter implements NotificationChannelAdapter {
  async send(_payload: NotificationPayload): Promise<NotificationResult> {
    throw new NotImplementedException(
      'SMS transport not yet wired. See adapters/sms.adapter.ts for full wiring instructions.',
    );
  }
}
