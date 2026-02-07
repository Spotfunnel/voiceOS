import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

interface SessionPayload {
  role?: 'customer' | 'operator';
  tenantId?: string | null;
  activeTenantId?: string | null;
  tenantName?: string | null;
  userId?: string | null;
}

const COOKIE_NAME = 'sf_session';

function parseSessionCookie(value?: string | null): SessionPayload {
  if (!value) return {};
  try {
    return JSON.parse(value) as SessionPayload;
  } catch {
    return {};
  }
}

export async function POST(request: Request) {
  const body = await request.json();
  const { activeTenantId, tenantName } = body || {};
  if (!activeTenantId || typeof activeTenantId !== 'string') {
    return NextResponse.json(
      { error: 'activeTenantId is required' },
      { status: 400 }
    );
  }

  const cookieStore = cookies();
  const existing =
    cookieStore.get(COOKIE_NAME)?.value || cookieStore.get('session')?.value;
  const session = parseSessionCookie(existing);

  if (session.role !== 'operator') {
    return NextResponse.json(
      { error: 'Operator role required' },
      { status: 403 }
    );
  }

  const updated: SessionPayload = {
    ...session,
    activeTenantId,
    tenantName: tenantName || session.tenantName || null,
  };

  const response = NextResponse.json({ ok: true, activeTenantId });
  response.cookies.set(COOKIE_NAME, JSON.stringify(updated), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  });
  return response;
}

export async function DELETE() {
  const cookieStore = cookies();
  const existing =
    cookieStore.get(COOKIE_NAME)?.value || cookieStore.get('session')?.value;
  const session = parseSessionCookie(existing);

  if (session.role !== 'operator') {
    return NextResponse.json(
      { error: 'Operator role required' },
      { status: 403 }
    );
  }

  const updated: SessionPayload = {
    ...session,
    activeTenantId: null,
  };

  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, JSON.stringify(updated), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  });
  return response;
}
