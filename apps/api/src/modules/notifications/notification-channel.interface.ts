export interface NotificationPayload {
  audience: 'ADMIN' | 'CUSTOMER';
  recipientId: string;
  recipientEmail?: string;
  recipientName?: string;
  eventType: string;
  title: string;
  body: string;
  actionUrl?: string;
  severity?: string;
  metadata?: Record<string, unknown>;
  branchId?: string;
}

export interface NotificationResult {
  success: boolean;
  externalId?: string;
  errorMessage?: string;
}

/**
 * Every notification channel implements this interface.
 * Callers are decoupled from the transport — swapping Resend for SendGrid
 * means updating only EmailAdapter, nothing else.
 */
export interface NotificationChannelAdapter {
  send(payload: NotificationPayload): Promise<NotificationResult>;
}
