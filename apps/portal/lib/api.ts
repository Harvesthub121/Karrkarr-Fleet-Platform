/**
 * Server-side typed API helpers — called from Server Components and Server Actions.
 * Each function reads the session, injects the access token, and handles
 * transparent token rotation when the API returns 401.
 */

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { apiFetch, ApiError } from './api-client';
import { getSession, setSession } from './session';
import type {
  CustomerDashboard,
  AuthTokens,
  AuthedCustomer,
  InvoiceStatusName,
} from '@vida/shared';

// ─── Types returned by the portal-specific endpoints ─────────────────────────

export interface CustomerInvoice {
  id: string;
  invoiceNo: string;
  status: InvoiceStatusName;
  periodStart: string;
  periodEnd: string;
  issueDate: string;
  dueDate: string;
  principalCents: number;
  interestAccruedCents: number;
  interestWaivedCents: number;
  paidCents: number;
  outstandingCents: number;
  appliedInterestRateBps: number;
  lines: Array<{
    id: string;
    description: string;
    quantity: number;
    unitPriceCents: number;
    amountCents: number;
  }>;
  submissions: Array<{
    id: string;
    status: 'PENDING_VERIFICATION' | 'APPROVED' | 'REJECTED';
    declaredAmountCents: number;
    transactionRef: string;
    paidOnDate: string;
    customerNote: string | null;
    submittedAt: string;
    rejectionReason: string | null;
  }>;
  payments: Array<{
    id: string;
    receiptNo: string;
    amountCents: number;
    method: string;
    transactionRef: string | null;
    receivedOn: string;
    receiptS3Key: string | null;
  }>;
}

export interface CustomerDocument {
  id: string;
  type: string;
  title: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  expiresAt: string | null;
  downloadUrl?: string; // presigned — set by backend
}

export interface PayNowQrResponse {
  invoiceNo: string;
  qrDataUri: string;
}

export interface UploadPresignResponse {
  uploadUrl: string;
  s3Key: string;
}

// ─── Session-aware fetch wrapper ──────────────────────────────────────────────

async function authFetch<T>(path: string, opts: Parameters<typeof apiFetch>[1]): Promise<T> {
  const session = await getSession();
  if (!session) redirect('/login');

  try {
    const result = await apiFetch<T>(path, {
      ...opts,
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
    });
    return result;
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 401) {
        // Refresh already attempted inside apiFetch; still 401 → expired
        redirect('/login');
      }
      throw err;
    }
    throw err;
  }
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function loginCustomer(email: string, password: string) {
  const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api';
  const res = await fetch(`${API_URL}/auth/customer/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body);
  }

  const tokens = (await res.json()) as AuthTokens & { customer: AuthedCustomer };
  return tokens;
}

export async function activateAccount(token: string, password: string) {
  const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api';
  const res = await fetch(`${API_URL}/auth/customer/activate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body);
  }
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export async function getDashboard(): Promise<CustomerDashboard> {
  return authFetch<CustomerDashboard>('/portal/dashboard', { method: 'GET' });
}

// ─── Invoices ─────────────────────────────────────────────────────────────────

export async function getMyInvoices(page = 1, pageSize = 20) {
  return authFetch<{ data: CustomerInvoice[]; total: number; totalPages: number }>(
    `/portal/invoices?page=${page}&pageSize=${pageSize}`,
    { method: 'GET' },
  );
}

export async function getInvoice(id: string): Promise<CustomerInvoice> {
  return authFetch<CustomerInvoice>(`/portal/invoices/${id}`, { method: 'GET' });
}

export async function getPayNowQr(invoiceId: string): Promise<PayNowQrResponse> {
  return authFetch<PayNowQrResponse>(`/payments/invoices/${invoiceId}/paynow-qr`, {
    method: 'GET',
  });
}

// ─── Documents ────────────────────────────────────────────────────────────────

export async function getMyDocuments(): Promise<CustomerDocument[]> {
  return authFetch<CustomerDocument[]>('/portal/documents', { method: 'GET' });
}

// ─── Profile ──────────────────────────────────────────────────────────────────

export interface UpdateProfilePayload {
  fullName?: string;
  phone?: string;
  address?: string;
}

export async function updateProfile(payload: UpdateProfilePayload) {
  return authFetch<AuthedCustomer>('/portal/profile', {
    method: 'PATCH',
    body: payload,
  });
}

export async function changePassword(currentPassword: string, newPassword: string) {
  return authFetch<void>('/portal/profile/password', {
    method: 'POST',
    body: { currentPassword, newPassword },
  });
}

// ─── Payment submission (multipart goes through proxy route) ─────────────────

export async function getProofUploadUrl(filename: string, mimeType: string): Promise<UploadPresignResponse> {
  return authFetch<UploadPresignResponse>('/portal/proof-upload-url', {
    method: 'POST',
    body: { filename, mimeType },
  });
}
