import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { loginCustomer } from '@/lib/api';
import { setSession } from '@/lib/session';
import { ApiError } from '@/lib/api-client';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { message: 'Email and password are required.' },
        { status: 400 },
      );
    }

    const result = await loginCustomer(email as string, password as string);

    const store = await cookies();
    await setSession(
      {
        customerId: result.customer.id,
        email: result.customer.email,
        fullName: result.customer.fullName,
        customerRef: result.customer.customerRef,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      },
      store,
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ApiError) {
      const body = err.body as Record<string, unknown> | null;
      const message =
        (body as { message?: string } | null)?.message ??
        (err.status === 401
          ? 'Invalid email or password.'
          : 'Login failed. Please try again.');
      return NextResponse.json({ message }, { status: err.status });
    }
    return NextResponse.json({ message: 'Unexpected error.' }, { status: 500 });
  }
}
