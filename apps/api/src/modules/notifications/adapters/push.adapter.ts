/**
 * PushAdapter — INTENTIONALLY NOT WIRED. Interface stub.
 *
 * TO WIRE THIS UP you need:
 *   1. A push notification service. Recommended:
 *      - Firebase Cloud Messaging (FCM) — free, covers iOS + Android + Web.
 *      - OneSignal as a managed alternative with a nice dashboard.
 *   2. For FCM: install `firebase-admin` SDK, set FIREBASE_SERVICE_ACCOUNT_JSON env var.
 *   3. Add a `PushToken` model to the schema (customerId, token, platform, createdAt)
 *      so the mobile app can register tokens on login.
 *   4. Replace the throw below with:
 *        const app = initializeApp({ credential: cert(serviceAccount) });
 *        const messaging = getMessaging(app);
 *        const tokens = await prisma.pushToken.findMany({ where: { customerId } });
 *        await messaging.sendEachForMulticast({ tokens, notification: { title, body } });
 *   5. Handle FCM's token invalidation responses — prune stale tokens from DB.
 *
 * The customer portal and any future mobile app can register tokens via
 * POST /notifications/push-token once this adapter is wired.
 */

import { Injectable } from '@nestjs/common';
import { NotImplementedException } from '@nestjs/common';
import type { NotificationChannelAdapter, NotificationPayload, NotificationResult } from '../notification-channel.interface';

@Injectable()
export class PushAdapter implements NotificationChannelAdapter {
  async send(_payload: NotificationPayload): Promise<NotificationResult> {
    throw new NotImplementedException(
      'Push notification transport not yet wired. See adapters/push.adapter.ts for full wiring instructions.',
    );
  }
}
