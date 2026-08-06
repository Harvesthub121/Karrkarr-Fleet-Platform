/**
 * WhatsAppAdapter — INTENTIONALLY NOT WIRED. Interface stub.
 *
 * TO WIRE THIS UP you need:
 *   1. A WhatsApp Business API provider account.
 *      Recommended: Twilio Conversations or Meta Cloud API directly.
 *   2. An approved WhatsApp Business template for each notification type
 *      (Meta's approval process takes 24-48h; template names must match here).
 *   3. Set env vars: WHATSAPP_API_TOKEN, WHATSAPP_PHONE_NUMBER_ID.
 *   4. Replace the throw below with a POST to:
 *        https://graph.facebook.com/v19.0/{PHONE_NUMBER_ID}/messages
 *      with the template name + customer's phone number in E.164 format.
 *   5. Customer.phone must be in E.164 — add a migration to add a
 *      `phoneE164` column or normalise on write.
 *
 * The rest of the notification pipeline (NotificationService, jobs) is ready
 * and will use this adapter the moment it is wired.
 */

import { Injectable } from '@nestjs/common';
import { NotImplementedException } from '@nestjs/common';
import type { NotificationChannelAdapter, NotificationPayload, NotificationResult } from '../notification-channel.interface';

@Injectable()
export class WhatsAppAdapter implements NotificationChannelAdapter {
  async send(_payload: NotificationPayload): Promise<NotificationResult> {
    throw new NotImplementedException(
      'WhatsApp transport not yet wired. See adapters/whatsapp.adapter.ts for full wiring instructions.',
    );
  }
}
