import { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'sf_session';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const tenantId = body?.tenantId as string | undefined;
  const tenantName = body?.tenantName as string | undefined;

  if (!tenantId) {
    return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
  }

  const session = {
    role: 'operator',
    tenantId,
    activeTenantId: tenantId,
    tenantName: tenantName || null,
    userId: 'admin',
  };

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, JSON.stringify(session), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  });
  return res;
}
