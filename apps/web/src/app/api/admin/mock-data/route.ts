import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const enabled = Boolean(body?.enabled);

  const res = NextResponse.json({ ok: true, enabled });
  res.cookies.set('sf_mock_data', enabled ? '1' : '0', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  });
  return res;
}
