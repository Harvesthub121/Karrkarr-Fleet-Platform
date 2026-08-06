import { NextRequest, NextResponse } from 'next/server';
import { activateAccount } from '@/lib/api';
import { ApiError } from '@/lib/api-client';

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json();
    if (!token || !password) {
      return NextResponse.json({ message: 'Token and password are required.' }, { status: 400 });
    }
    await activateAccount(token as string, password as string);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ApiError) {
      const body = err.body as { message?: string } | null;
      return NextResponse.json(
        { message: body?.message ?? 'Activation failed.' },
        { status: err.status },
      );
    }
    return NextResponse.json({ message: 'Unexpected error.' }, { status: 500 });
  }
}
