import { NextRequest, NextResponse } from 'next/server';

const VOICE_CORE_URL = process.env.VOICE_CORE_URL || 'http://localhost:8000';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get('token');
    const tokenType = searchParams.get('token_type') || 'invitation';

    if (!token) {
      return NextResponse.json(
        { valid: false, error_message: 'Token is required' },
        { status: 400 }
      );
    }

    const response = await fetch(
      `${VOICE_CORE_URL}/api/auth/validate-token?token=${encodeURIComponent(token)}&token_type=${tokenType}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error validating token:', error);
    return NextResponse.json(
      { valid: false, error_message: 'Failed to validate token' },
      { status: 500 }
    );
  }
}
