import { NextRequest, NextResponse } from 'next/server';

const VOICE_CORE_URL = process.env.VOICE_CORE_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const response = await fetch(`${VOICE_CORE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    // Set HTTP-only cookie with session token
    const res = NextResponse.json(data);
    res.cookies.set('session_token', data.session_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    // Set session context for server-side routing
    res.cookies.set('sf_session', JSON.stringify({
      role: data.role || 'customer',
      tenantId: data.tenant_id,
      activeTenantId: data.tenant_id,
      tenantName: null,
      userId: data.user_id,
    }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    return res;
  } catch (error) {
    console.error('Error logging in:', error);
    return NextResponse.json(
      { detail: 'Login failed' },
      { status: 500 }
    );
  }
}
